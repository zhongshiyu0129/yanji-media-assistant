import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createProjectStore } from "./project-store.mjs";

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function quotaError(message) {
  return Object.assign(new Error(message), { statusCode: 429 });
}

export function createPublicRuntime(root, options = {}) {
  const enabled = options.enabled ?? process.env.PUBLIC_DEMO_MODE === "true";
  if (!enabled) return { enabled: false };

  const secret = options.secret || process.env.APP_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("PUBLIC_DEMO_MODE=true 时必须配置至少 24 位的 APP_SECRET");
  }

  const dataRoot = path.resolve(options.dataRoot || process.env.YANJI_DATA_DIR || path.join(root, ".public-data"));
  const limitOverrides = options.limits || {};
  const limits = {
    aiPerSession: positiveInteger(limitOverrides.aiPerSession ?? process.env.PUBLIC_DAILY_AI_LIMIT, 10),
    searchPerSession: positiveInteger(limitOverrides.searchPerSession ?? process.env.PUBLIC_DAILY_SEARCH_LIMIT, 20),
    aiTotal: positiveInteger(limitOverrides.aiTotal ?? process.env.PUBLIC_DAILY_AI_LIMIT_TOTAL, 100),
    searchTotal: positiveInteger(limitOverrides.searchTotal ?? process.env.PUBLIC_DAILY_SEARCH_LIMIT_TOTAL, 300),
    projectsPerSession: positiveInteger(limitOverrides.projectsPerSession ?? process.env.PUBLIC_PROJECT_LIMIT, 8)
  };
  const sessionStores = new Map();
  const minuteUsage = new Map();
  const usagePath = path.join(dataRoot, "usage.json");
  let usageQueue = Promise.resolve();

  function signature(id) {
    return crypto.createHmac("sha256", secret).update(id).digest("base64url");
  }

  function parseCookies(header = "") {
    return Object.fromEntries(header.split(";").flatMap((part) => {
      const index = part.indexOf("=");
      if (index < 1) return [];
      return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
    }));
  }

  function validSession(value = "") {
    const [id, provided] = value.split(".");
    if (!/^[a-f0-9]{32}$/.test(id || "") || !provided) return "";
    const expected = Buffer.from(signature(id));
    const actual = Buffer.from(provided);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? id : "";
  }

  function sessionFor(request, response) {
    const cookies = parseCookies(request.headers.cookie);
    let id = validSession(cookies.yanji_session);
    if (!id) {
      id = crypto.randomBytes(16).toString("hex");
      const secure = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
      response.setHeader("Set-Cookie", `yanji_session=${id}.${signature(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure ? "; Secure" : ""}`);
    }
    return id;
  }

  function context(request, response) {
    const sessionId = sessionFor(request, response);
    const sessionRoot = path.join(dataRoot, "sessions", sessionId);
    if (!sessionStores.has(sessionId)) {
      sessionStores.set(sessionId, createProjectStore(root, {
        projectsRoot: path.join(sessionRoot, "projects"),
        publicDemo: true,
        accountName: "你的账号"
      }));
    }
    return {
      sessionId,
      store: sessionStores.get(sessionId),
      memoryPath: path.join(sessionRoot, "memory.json")
    };
  }

  function checkMinuteLimit(sessionId, kind) {
    const minute = Math.floor(Date.now() / 60_000);
    const key = `${sessionId}:${kind}:${minute}`;
    const count = (minuteUsage.get(key) || 0) + 1;
    const perMinute = kind === "ai" ? 3 : 8;
    if (count > perMinute) throw quotaError(`操作太频繁，请一分钟后再试（每分钟最多 ${perMinute} 次）`);
    minuteUsage.set(key, count);
    if (minuteUsage.size > 10_000) {
      for (const entry of minuteUsage.keys()) {
        if (!entry.endsWith(`:${minute}`)) minuteUsage.delete(entry);
      }
    }
  }

  async function readUsage() {
    try {
      const parsed = JSON.parse(await fs.readFile(usagePath, "utf8"));
      if (parsed.date === new Date().toISOString().slice(0, 10)) return parsed;
    } catch { /* a missing or incomplete counter starts a new day */ }
    return { date: new Date().toISOString().slice(0, 10), total: { ai: 0, search: 0 }, sessions: {} };
  }

  async function consume(sessionId, kind) {
    checkMinuteLimit(sessionId, kind);
    const work = usageQueue.then(async () => {
      const usage = await readUsage();
      const session = usage.sessions[sessionId] || { ai: 0, search: 0 };
      const sessionLimit = kind === "ai" ? limits.aiPerSession : limits.searchPerSession;
      const totalLimit = kind === "ai" ? limits.aiTotal : limits.searchTotal;
      if ((session[kind] || 0) >= sessionLimit) {
        throw quotaError(`你今天的${kind === "ai" ? " AI 生成" : "事实搜索"}体验次数已用完，明天再来试试`);
      }
      if ((usage.total[kind] || 0) >= totalLimit) {
        throw quotaError("今天的全站体验额度已用完，请明天再来");
      }
      session[kind] = (session[kind] || 0) + 1;
      usage.total[kind] = (usage.total[kind] || 0) + 1;
      usage.sessions[sessionId] = session;
      await fs.mkdir(dataRoot, { recursive: true });
      const temporary = `${usagePath}.${process.pid}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify(usage, null, 2)}\n`, "utf8");
      await fs.rename(temporary, usagePath);
      return {
        aiRemaining: Math.max(0, limits.aiPerSession - session.ai),
        searchRemaining: Math.max(0, limits.searchPerSession - session.search)
      };
    });
    usageQueue = work.catch(() => {});
    return work;
  }

  return { enabled: true, context, consume, limits, dataRoot };
}
