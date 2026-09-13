import fs from "node:fs/promises";
import path from "node:path";

export const FILES = {
  workspace: { label: "创作状态", path: "context/workspace.json", group: "系统" },
  original: { label: "原始稿", path: "input/original_script.md", group: "输入" },
  brief: { label: "项目 Brief", path: "context/project_brief.md", group: "输入" },
  extraction: { label: "表达提取", path: "process/source_extraction.md", group: "过程" },
  corrected: { label: "轻度纠错", path: "process/corrected_script.md", group: "过程" },
  hooks: { label: "开头方案", path: "process/hook_options.md", group: "过程" },
  rewrite: { label: "降重改写", path: "process/rewrite_draft.md", group: "过程" },
  deepened: { label: "内容深化", path: "process/deepened_draft.md", group: "过程" },
  styled: { label: "风格融合", path: "process/style_draft.md", group: "过程" },
  review: { label: "事实与合规", path: "process/review_report.md", group: "审查" },
  publish: { label: "发布包装", path: "process/publish_package.md", group: "交付" },
  memory: { label: "记忆建议", path: "process/memory_update.md", group: "交付" },
  voiceover: { label: "最终口播稿", path: "final/voiceover.md", group: "最终" },
  subtitle: { label: "字幕安全版", path: "final/subtitle.md", group: "最终" },
  log: { label: "工作流日志", path: "logs/workflow_log.md", group: "记录" }
};

const REQUIRED_DIRS = ["input", "context", "process", "final", "logs"];

export function normalizeSlug(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff._-]+/gu, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 72);
  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error("请输入有效的项目名称");
  }
  return normalized;
}

export function assertProjectId(value) {
  const id = String(value || "");
  if (!/^[a-z0-9\u4e00-\u9fff][a-z0-9\u4e00-\u9fff._-]{0,71}$/u.test(id)) {
    throw new Error("项目 ID 不合法");
  }
  return id;
}

export function createProjectStore(root) {
  const projectsRoot = path.join(root, "projects");

  function projectPath(id) {
    return path.join(projectsRoot, assertProjectId(id));
  }

  async function readOptional(filePath) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return "";
      throw error;
    }
  }

  function titleFromMarkdown(markdown, fallback) {
    const titleSection = markdown.match(/##\s*标题\s*\n+([^\n#]+)/u);
    if (titleSection?.[1]?.trim()) return titleSection[1].trim();
    const heading = markdown.match(/^#\s+(.+)$/m);
    return heading?.[1]?.trim() || fallback;
  }

  function withTitle(markdown, title) {
    if (/##\s*标题\s*\n/u.test(markdown)) {
      return markdown.replace(/(##\s*标题\s*\n+)[^\n]*/u, `$1${title}`);
    }
    return `${markdown.trim()}\n\n## 标题\n\n${title}\n`;
  }

  function hasMeaningfulContent(key, content) {
    if (!content.trim()) return false;
    const stripped = content
      .replace(/^#.*$/gm, "")
      .replace(/^##.*$/gm, "")
      .replace(/请把已经提取好的原视频口播稿粘贴到这里。/g, "")
      .replace(/本文件由素材引用工具生成。当前项目尚未选择采集素材。/g, "")
      .trim();
    if (["voiceover", "subtitle"].includes(key)) return stripped.length > 8;
    return stripped.length > 12;
  }

  async function summarize(id) {
    const base = projectPath(id);
    const original = await readOptional(path.join(base, FILES.original.path));
    const workspaceContent = await readOptional(path.join(base, FILES.workspace.path));
    const stats = await fs.stat(base);
    let latestModified = stats.mtimeMs;
    const stages = {};
    for (const [key, descriptor] of Object.entries(FILES)) {
      const filePath = path.join(base, descriptor.path);
      const [content, fileStats] = await Promise.all([
        readOptional(filePath),
        fs.stat(filePath).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error))
      ]);
      if (fileStats) latestModified = Math.max(latestModified, fileStats.mtimeMs);
      stages[key] = hasMeaningfulContent(key, content);
    }
    const completed = Object.values(stages).filter(Boolean).length;
    let metadata = {};
    try { metadata = JSON.parse(workspaceContent).metadata || {}; }
    catch { metadata = {}; }
    return {
      id,
      title: titleFromMarkdown(original, id),
      domain: metadata.domain || "",
      tags: Array.isArray(metadata.tags) ? metadata.tags.slice(0, 3) : [],
      updatedAt: new Date(latestModified).toISOString(),
      completed,
      total: Object.keys(FILES).length,
      progress: Math.round((completed / Object.keys(FILES).length) * 100),
      stages
    };
  }

  async function list() {
    await fs.mkdir(projectsRoot, { recursive: true });
    const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
    const items = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => summarize(entry.name))
    );
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async function details(id) {
    const summary = await summarize(id);
    const files = {};
    for (const [key, descriptor] of Object.entries(FILES)) {
      const content = await readOptional(path.join(projectPath(id), descriptor.path));
      files[key] = { ...descriptor, exists: Boolean(content), content };
    }
    return { ...summary, files };
  }

  async function create({ name, title }) {
    const id = normalizeSlug(name);
    const base = projectPath(id);
    try {
      await fs.access(base);
      throw new Error(`项目已存在：${id}`);
    } catch (error) {
      if (error.message.startsWith("项目已存在")) throw error;
      if (error.code !== "ENOENT") throw error;
    }
    await Promise.all(REQUIRED_DIRS.map((dir) => fs.mkdir(path.join(base, dir), { recursive: true })));
    const files = {
      [FILES.original.path]: `# 原始口播稿\n\n## 标题\n\n${title || id}\n\n## 原文\n\n\n## 来源备注\n\n- 来源平台：\n- 作者：\n- 链接：\n\n## 本项目要求\n\n- 希望保留：\n- 希望避免：\n`,
      [FILES.brief.path]: `# 项目 Brief\n\n## 主题\n\n${title || id}\n\n## 目标观众\n\n## 本次风格\n\n## 用户确认记录\n`,
      [FILES.extraction.path]: "# 原视频表达提取\n\n## 金句\n\n## 情绪句\n\n## 悬念与节奏\n\n## 事实风险\n",
      [FILES.voiceover.path]: "# 最终口播稿\n",
      [FILES.subtitle.path]: "# 字幕安全版\n",
      [FILES.log.path]: `# Workflow Log\n\n- 创建时间：${new Date().toISOString()}\n- 项目：${id}\n`
    };
    files["context/account.yaml"] = "account_id: default\naccount_path: ../../accounts/default\n";
    const accountYaml = await readOptional(path.join(root, "accounts/default/account.yaml"));
    const accountNameMatch = accountYaml.match(/^name:\s*(.+)$/m);
    const accountName = accountNameMatch ? accountNameMatch[1].trim() : "你的账号";
    files[FILES.workspace.path] = JSON.stringify({
      version: 1,
      accountName,
      currentStage: "source",
      settings: { targetLength: 1800, specialInstructions: "", stageInstructions: {} },
      metadata: { domain: "", tags: [], generated: false },
      openingOptions: [],
      endingOptions: [],
      factChecks: [],
      complianceIssues: [],
      publish: { titles: [], descriptions: [], tags: [], comments: [], pronunciations: [] },
      conversation: [],
      projectMemory: { notes: [] },
      decisions: {}
    }, null, 2) + "\n";
    files["input/material_refs.json"] = '{\n  "created_at": "",\n  "material_root": "采集工作台/素材库",\n  "items": []\n}\n';
    await Promise.all(
      Object.entries(files).map(async ([relative, content]) => {
        const targetPath = path.join(base, relative);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, content, "utf8");
      })
    );
    return details(id);
  }

  async function save(id, key, content) {
    if (!Object.hasOwn(FILES, key)) throw new Error("未知文件类型");
    if (typeof content !== "string") throw new Error("文件内容必须是文本");
    if (Buffer.byteLength(content, "utf8") > 2_000_000) throw new Error("单个文件不能超过 2MB");
    const base = projectPath(id);
    await fs.access(base);
    const target = path.join(base, FILES[key].path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
    return { key, savedAt: new Date().toISOString() };
  }

  async function updateMetadata(id, { title, domain, tags }) {
    const base = projectPath(id);
    await fs.access(base);
    const originalPath = path.join(base, FILES.original.path);
    const workspacePath = path.join(base, FILES.workspace.path);
    const [original, workspaceContent] = await Promise.all([
      readOptional(originalPath), readOptional(workspacePath)
    ]);
    let workspace = {};
    try { workspace = JSON.parse(workspaceContent || "{}"); }
    catch { workspace = {}; }
    const safeTitle = String(title || titleFromMarkdown(original, id)).trim().slice(0, 60) || id;
    const safeDomain = String(domain || "其他").trim().slice(0, 12);
    const safeTags = Array.isArray(tags)
      ? tags.map((tag) => String(tag).replace(/^#/, "").trim()).filter(Boolean).slice(0, 3)
      : [];
    workspace.metadata = { ...(workspace.metadata || {}), domain: safeDomain, tags: safeTags, generated: false, updatedAt: new Date().toISOString() };
    await Promise.all([
      fs.writeFile(originalPath, withTitle(original, safeTitle), "utf8"),
      fs.writeFile(workspacePath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8")
    ]);
    return details(id);
  }

  async function remove(id) {
    const source = projectPath(id);
    await fs.access(source);
    const trashRoot = path.join(projectsRoot, ".trash");
    await fs.mkdir(trashRoot, { recursive: true });
    const destination = path.join(trashRoot, `${id}-${Date.now()}`);
    await fs.rename(source, destination);
    return { id, recoverable: true };
  }

  return { list, details, create, save, updateMetadata, remove };
}
