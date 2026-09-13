import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectStore } from "./project-store.mjs";
import { createAIService } from "./ai-service.mjs";
import { fetchSourcePreview, searchWebSources } from "./source-preview.mjs";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(serverDir, "..");
const publicDir = path.join(root, "web");

async function loadLocalEnv(filePath) {
  const content = await fs.readFile(filePath, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[2] === "" || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

await loadLocalEnv(path.join(root, ".env.local"));

const store = createProjectStore(root);
const ai = createAIService(root);
const port = Number(process.env.PORT || 4173);
const memoryPath = path.join(root, "accounts/default/memory/editorial_memory.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function bodyJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 2_100_000) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readMemory() {
  try { return JSON.parse(await fs.readFile(memoryPath, "utf8")); }
  catch { return { version: 1, preferences: [], learningHistory: [] }; }
}

async function saveLearning(payload) {
  const memory = await readMemory();
  const preferences = Array.isArray(payload.preferences)
    ? payload.preferences.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
    : [];
  memory.preferences = [...new Set([...preferences, ...(memory.preferences || [])])].slice(0, 60);
  memory.learningHistory = [{
    projectId: String(payload.projectId || ""),
    title: String(payload.title || "").slice(0, 80),
    summary: String(payload.summary || "").slice(0, 2000),
    preferences,
    learnedAt: new Date().toISOString()
  }, ...(memory.learningHistory || [])].slice(0, 50);
  memory.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(memoryPath), { recursive: true });
  await fs.writeFile(memoryPath, `${JSON.stringify(memory, null, 2)}\n`, "utf8");
  return memory;
}

async function writeMemory(memory) {
  const next = { version: 1, preferences: [], learningHistory: [], ...memory, updatedAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(memoryPath), { recursive: true });
  await fs.writeFile(memoryPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

async function api(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, { ok: true, version: "0.1.0" });
  }
  if (request.method === "GET" && url.pathname === "/api/ai/status") {
    return sendJson(response, 200, ai.status());
  }
  if (request.method === "GET" && url.pathname === "/api/memory") {
    return sendJson(response, 200, await readMemory());
  }
  if (request.method === "POST" && url.pathname === "/api/memory") {
    return sendJson(response, 200, await saveLearning(await bodyJson(request)));
  }
  if (request.method === "PUT" && url.pathname === "/api/memory") {
    const current = await readMemory();
    const payload = await bodyJson(request);
    const preferences = Array.isArray(payload.preferences) ? payload.preferences.map((item) => String(item).trim()).filter(Boolean).slice(0, 60) : [];
    return sendJson(response, 200, await writeMemory({ ...current, preferences }));
  }
  if (request.method === "DELETE" && url.pathname === "/api/memory") {
    return sendJson(response, 200, await writeMemory({ version: 1, preferences: [], learningHistory: [] }));
  }
  if (request.method === "POST" && url.pathname === "/api/source-preview") {
    return sendJson(response, 200, await fetchSourcePreview(await bodyJson(request)));
  }
  if (request.method === "POST" && url.pathname === "/api/source-search") {
    const payload = await bodyJson(request);
    return sendJson(response, 200, { sources: await searchWebSources(payload.query) });
  }
  if (request.method === "POST" && url.pathname === "/api/ai/run") {
    const payload = await bodyJson(request);
    const result = await ai.run({
      apiKey: request.headers["x-ai-api-key"] || request.headers["x-openai-api-key"],
      provider: payload.provider,
      stage: payload.stage,
      model: payload.model,
      payload: payload.payload
    });
    return sendJson(response, 200, result);
  }
  if (request.method === "GET" && url.pathname === "/api/projects") {
    return sendJson(response, 200, { projects: await store.list() });
  }
  if (request.method === "POST" && url.pathname === "/api/projects") {
    return sendJson(response, 201, { project: await store.create(await bodyJson(request)) });
  }
  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (request.method === "GET" && projectMatch) {
    return sendJson(response, 200, { project: await store.details(decodeURIComponent(projectMatch[1])) });
  }
  if (request.method === "PATCH" && projectMatch) {
    return sendJson(response, 200, { project: await store.updateMetadata(decodeURIComponent(projectMatch[1]), await bodyJson(request)) });
  }
  if (request.method === "DELETE" && projectMatch) {
    return sendJson(response, 200, await store.remove(decodeURIComponent(projectMatch[1])));
  }
  const fileMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/files\/([^/]+)$/);
  if (request.method === "PUT" && fileMatch) {
    const payload = await bodyJson(request);
    const result = await store.save(
      decodeURIComponent(fileMatch[1]),
      decodeURIComponent(fileMatch[2]),
      payload.content
    );
    return sendJson(response, 200, result);
  }
  return sendJson(response, 404, { error: "接口不存在" });
}

async function staticFile(response, url) {
  const requested = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, "");
  const normalized = path.normalize(requested);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return sendJson(response, 403, { error: "禁止访问" });
  }
  const filePath = path.join(publicDir, normalized);
  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      const index = await fs.readFile(path.join(publicDir, "index.html"));
      response.writeHead(200, { "Content-Type": mimeTypes[".html"] });
      response.end(index);
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) await api(request, response, url);
    else await staticFile(response, url);
  } catch (error) {
    console.error(error);
    sendJson(response, error instanceof SyntaxError ? 400 : error.statusCode || 500, { error: error.message || "服务器错误" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`\n  言己已启动：http://127.0.0.1:${port}\n`);
});
