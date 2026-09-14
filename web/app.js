const state = {
  projects: [],
  project: null,
  workspace: null,
  domainFilter: "全部",
  activeStage: "source",
  sourceDirty: false,
  correctedDirty: false,
  rewriteDirty: false,
  metadataRunning: false,
  reviewMode: "annotated",
  instructionStage: "rewrite",
  accountMemory: { preferences: [], learningHistory: [] },
  reviewChatTarget: null,
  selectionEdit: null,
  selectionRunning: false,
  chatRunning: false,
  sourceSearches: {},
  ai: { configured: false, provider: "deepseek", providerLabel: "DeepSeek", defaultModel: "deepseek-flash", running: false, progress: null }
};

let metadataTimer;
let optionSaveTimer;
let aiProgressTimer;
let sourceSearchTimer;

const AI_KEY_STORAGE = "yanji-openai-api-key";
const AI_MODEL_STORAGE = "yanji-openai-model";
const AI_PROVIDER_STORAGE = "yanji-ai-provider";
const SEARCH_KEY_STORAGE = "yanji-search-api-key";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const els = {
  sidebar: $("#sidebar"), projectList: $("#projectList"), projectCount: $("#projectCount"), domainFilters: $("#domainFilters"),
  breadcrumbTitle: $("#breadcrumbTitle"), projectTitle: $("#projectTitle"), projectMeta: $("#projectMeta"),
  saveState: $("#saveState"), workflowNav: $("#workflowNav"), stageContent: $("#stageContent"),
  processDialog: $("#processDialog"), processNav: $("#processNav"), processContent: $("#processContent"),
  editorDialog: $("#editorDialog"), resultEditor: $("#resultEditor"), toast: $("#toast"),
  generateButton: $("#generateButton"), aiSettingsDialog: $("#aiSettingsDialog"),
  aiSettingsForm: $("#aiSettingsForm"), apiKeyInput: $("#apiKeyInput"), modelInput: $("#modelInput"),
  searchKeyInput: $("#searchKeyInput"),
  providerInput: $("#providerInput"),
  projectManageDialog: $("#projectManageDialog"), projectManageForm: $("#projectManageForm"),
  manageProjectId: $("#manageProjectId"), manageTitle: $("#manageTitle"), manageDomain: $("#manageDomain"), manageTags: $("#manageTags"),
  rewritePromptDialog: $("#rewritePromptDialog"), rewritePromptForm: $("#rewritePromptForm"), specialInstructions: $("#specialInstructions"),
  instructionDialogTitle: $("#instructionDialogTitle"), fixedRequirements: $("#fixedRequirements"),
  chatDialog: $("#chatDialog"), chatMessages: $("#chatMessages"), chatForm: $("#chatForm"), chatInput: $("#chatInput"),
  chatStageBadge: $("#chatStageBadge"), chatMemoryStatus: $("#chatMemoryStatus"), sendChatButton: $("#sendChatButton"),
  chatDialogTitle: $("#chatDialogTitle"), chatCardContext: $("#chatCardContext"),
  sourcePreviewDialog: $("#sourcePreviewDialog"), sourcePreviewTitle: $("#sourcePreviewTitle"), sourcePreviewUrl: $("#sourcePreviewUrl"), sourcePreviewBody: $("#sourcePreviewBody"), openOriginalSource: $("#openOriginalSource"),
  connectionDot: $("#connectionDot"), connectionText: $("#connectionText"), memoryCount: $("#memoryCount")
};

const stageLabels = {
  source: "整理原稿", rewrite: "生成改写稿", openings: "组合成稿",
  review: "检查整合稿", publish: "生成发布素材"
};

const stageNames = { source: "原稿整理", rewrite: "AI 改写", openings: "开头结尾", review: "全文审校", publish: "发布素材" };
const stageOrder = ["source", "rewrite", "openings", "review", "publish"];
const fixedRequirements = {
  source: ["保留原意", "修正错字", "纠正断句", "整理成大段落"],
  rewrite: ["大白话", "知识密度高", "节奏紧", "保留爆点", "大段落", "严格控字数"],
  openings: ["多个方向", "正文接得住", "开头抓人", "结尾有余味"],
  review: ["结合全文", "事实有来源", "风险不机械替换", "接受后定位修改"],
  publish: ["标题不虚构", "描述不重复", "互动具体", "标注易读错字词"]
};

const processFiles = [
  ["extraction", "原稿拆解"], ["corrected", "转写纠错"], ["hooks", "开头方案"],
  ["rewrite", "重构初稿"], ["deepened", "内容深化"], ["styled", "风格校准"],
  ["review", "事实与合规"], ["log", "操作记录"]
];

async function request(url, options = {}) {
  const baseHeaders = { "Content-Type": "application/json" };
  if (sessionKey()) baseHeaders["X-AI-Api-Key"] = sessionKey();
  if (searchKey()) baseHeaders["X-Search-Api-Key"] = searchKey();
  const response = await fetch(url, { headers: baseHeaders, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function markdown(value = "") {
  let html = escapeHtml(value);
  html = html.replace(/((?:^\|.*\|\n?){2,})/gm, (block) => {
    const rows = block.trim().split("\n").map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()));
    if (rows.length < 2 || !rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) return block;
    return `<table><thead><tr>${rows[0].map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.slice(2).map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>\n`;
  });
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>").replace(/(?:<li>.*<\/li>\n?)+/g, (items) => `<ul>${items}</ul>`);
  return html.split(/\n{2,}/).map((block) => /^(<h|<ul|<blockquote|<table)/.test(block) ? block : `<p>${block.replace(/\n/g, "<br>")}</p>`).join("");
}

function timeAgo(value) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} 小时前` : `${Math.round(hours / 24)} 天前`;
}

function textLength(value = "") { return String(value).replace(/\s/g, "").length; }

function formatCorrectedDraft(value = "") {
  const text = String(value).replace(/\r/g, "").replace(/[ \t\u3000]+/gu, " ").trim();
  if (!text) return "";
  const compact = text.replace(/\n+/g, "");
  const sentences = compact.match(/[^\u3002\uff01\uff1f!?]+[\u3002\uff01\uff1f!?]?/gu) || [compact];
  const paragraphCount = Math.max(1, Math.min(6, Math.round(textLength(compact) / 420)));
  const targetSize = Math.ceil(textLength(compact) / paragraphCount);
  const paragraphs = [];
  let current = "";
  for (const sentence of sentences) {
    current += sentence.trim();
    if (textLength(current) >= targetSize && paragraphs.length < paragraphCount - 1) {
      paragraphs.push(current);
      current = "";
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs.map((paragraph) => `\u3000\u3000${paragraph.trim()}`).join("\n");
}

function sourceBody(value = "") {
  const match = value.match(/##\s*原文\s*\n+([\s\S]*?)(?=\n##\s|$)/u);
  const body = match?.[1]?.trim() || "";
  return body === "请在这里粘贴需要处理的原稿。" ? "" : body;
}

function withSourceBody(markdownText = "", body = "") {
  if (/##\s*原文\s*\n/u.test(markdownText)) {
    return markdownText.replace(/(##\s*原文\s*\n+)[\s\S]*?(?=\n##\s|$)/u, `$1${body.trim()}\n`);
  }
  return `${markdownText.trim()}\n\n## 原文\n\n${body.trim()}\n`;
}

function withProjectTitle(markdownText = "", title = "") {
  if (/##\s*标题\s*\n/u.test(markdownText)) {
    return markdownText.replace(/(##\s*标题\s*\n+)[^\n]*/u, `$1${title.trim()}`);
  }
  return `${markdownText.trim()}\n\n## 标题\n\n${title.trim()}\n`;
}

function stripHeading(value = "") { return value.replace(/^#.*$/gm, "").trim(); }
function isMeaningful(value = "") { return stripHeading(value).length > 12; }

function defaultWorkspace() {
  return {
    version: 1, accountName: "你的账号", currentStage: "source",
    settings: { targetLength: 1800, specialInstructions: "", stageInstructions: {} },
    metadata: { domain: "", tags: [], generated: false },
    openingOptions: [], endingOptions: [], factChecks: [], complianceIssues: [],
    publish: { titles: [], descriptions: [], tags: [], comments: [], pronunciations: [] },
    conversation: [], projectMemory: { notes: [] }, learningCandidates: [], decisions: {}
  };
}

function loadWorkspace(project) {
  try {
    const raw = project.files.workspace?.content;
    if (!raw) return defaultWorkspace();
    const parsed = JSON.parse(raw);
    const defaults = defaultWorkspace();
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      metadata: { ...defaults.metadata, ...(parsed.metadata || {}) },
      publish: { ...defaults.publish, ...(parsed.publish || {}) },
      conversation: Array.isArray(parsed.conversation) ? parsed.conversation : [],
      decisions: parsed.decisions || {}
    };
  } catch { return defaultWorkspace(); }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2500);
}

async function saveFile(key, content) {
  await request(`/api/projects/${encodeURIComponent(state.project.id)}/files/${key}`, {
    method: "PUT", body: JSON.stringify({ content })
  });
  state.project.files[key].content = content;
}

async function saveWorkspace() {
  clearTimeout(optionSaveTimer);
  await saveFile("workspace", `${JSON.stringify(state.workspace, null, 2)}\n`);
  els.saveState.textContent = "已自动保存在本地";
}

function queueWorkspaceSave() {
  clearTimeout(optionSaveTimer);
  els.saveState.textContent = "正在保存手动修改…";
  const projectId = state.project.id;
  const content = `${JSON.stringify(state.workspace, null, 2)}\n`;
  optionSaveTimer = setTimeout(async () => {
    try {
      await request(`/api/projects/${encodeURIComponent(projectId)}/files/workspace`, { method: "PUT", body: JSON.stringify({ content }) });
      if (state.project?.id === projectId) {
        state.project.files.workspace.content = content;
        els.saveState.textContent = "已自动保存在本地";
      }
    } catch (error) { showToast(error.message); }
  }, 500);
}

function renderProjects() {
  els.projectCount.textContent = state.projects.length;
  const domains = [...new Set(state.projects.map((project) => project.domain).filter(Boolean))];
  if (state.domainFilter !== "全部" && !domains.includes(state.domainFilter)) state.domainFilter = "全部";
  els.domainFilters.innerHTML = ["全部", ...domains].map((domain) => `<button class="${state.domainFilter === domain ? "active" : ""}" data-domain-filter="${escapeHtml(domain)}">${escapeHtml(domain)}</button>`).join("");
  const visibleProjects = state.domainFilter === "全部" ? state.projects : state.projects.filter((project) => project.domain === state.domainFilter);
  els.projectList.innerHTML = visibleProjects.map((project) => `
    <div class="project-row ${project.id === state.project?.id ? "active" : ""}">
      <button class="project-item" data-project="${escapeHtml(project.id)}" title="${escapeHtml(project.title)}">
        <strong>${escapeHtml(project.title)}</strong>
        <span class="project-domain-tags">${project.domain ? `<em>${escapeHtml(project.domain)}</em>` : /^未命名口播稿/.test(project.title) ? "<u>待分类</u>" : ""}${(project.tags || []).map((tag) => `<i>${escapeHtml(tag)}</i>`).join("")}</span>
        <small><span>${project.stages.voiceover ? "已有成稿" : "创作中"}</span><span>${timeAgo(project.updatedAt)}</span></small>
        <span class="project-mini-progress"><i style="width:${project.progress}%"></i></span>
      </button>
      <button class="project-manage-button" data-project-manage="${escapeHtml(project.id)}" title="整理或删除" aria-label="整理或删除 ${escapeHtml(project.title)}">•••</button>
    </div>`).join("") || '<div class="project-empty">这个领域还没有稿件</div>';
  $$('[data-project]', els.projectList).forEach((button) => button.addEventListener("click", () => selectProject(button.dataset.project)));
  $$('[data-project-manage]', els.projectList).forEach((button) => button.addEventListener("click", () => openProjectManager(button.dataset.projectManage)));
  $$('[data-domain-filter]', els.domainFilters).forEach((button) => button.addEventListener("click", () => {
    state.domainFilter = button.dataset.domainFilter;
    renderProjects();
  }));
}

function renderProjectHeader() {
  els.breadcrumbTitle.textContent = state.project.title;
  els.projectTitle.textContent = state.project.title;
  els.projectMeta.textContent = `${state.workspace.accountName || "你的账号"} · 更新于 ${timeAgo(state.project.updatedAt)}`;
  els.generateButton.childNodes[els.generateButton.childNodes.length - 1].textContent = state.ai.running ? " AI 生成中…" : ` ${stageLabels[state.activeStage]}`;
  els.generateButton.disabled = state.ai.running;
  els.generateButton.classList.toggle("loading", state.ai.running);
  els.memoryCount.textContent = `${state.accountMemory.preferences?.length || 0} 条偏好 · 点击查看`;
  $$('[data-stage]', els.workflowNav).forEach((button) => button.classList.toggle("active", button.dataset.stage === state.activeStage));
}

function sourceStage() {
  const original = sourceBody(state.project.files.original.content);
  const corrected = isMeaningful(state.project.files.corrected.content) ? formatCorrectedDraft(stripHeading(state.project.files.corrected.content)) : "";
  return `
    <div class="stage-heading"><div><span>STEP 01</span><h2>先把原稿整理干净</h2><p>粘贴后会自动生成侧栏标题与领域标签，再修正错别字、错误断句和语音转写。</p></div><div class="stage-summary"><b>${textLength(original)}</b><span>原稿字数</span></div></div>
    <div class="dual-editor">
      <article class="editor-box">
        <header><div><b>扒取的原始稿</b><span>保持原样留档</span></div><em id="sourceCount">${textLength(original)} 字</em></header>
        <textarea id="sourceEditor" spellcheck="false" placeholder="把视频口播稿粘贴到这里…">${escapeHtml(original)}</textarea>
        <footer><span>原始版本始终保留</span><button data-action="save-source">保存原稿</button></footer>
      </article>
      <div class="between-arrow"><span>AI 整理</span><i>→</i></div>
      <article class="editor-box corrected-box">
        <header><div><b>整理后的原始稿</b><span>纠错、断句与分段</span></div><em id="correctedCount">${textLength(corrected)} 字</em></header>
        <textarea id="correctedEditor" spellcheck="false" placeholder="AI 整理后的稿件会显示在这里，你可以继续修改。">${escapeHtml(corrected)}</textarea>
        <footer><span>✓ 不改原意，只整理文本</span><button data-action="save-corrected">保存整理稿</button></footer>
      </article>
    </div>`;
}

function rewriteStage() {
  const source = isMeaningful(state.project.files.corrected.content) ? formatCorrectedDraft(stripHeading(state.project.files.corrected.content)) : sourceBody(state.project.files.original.content);
  const resultKey = isMeaningful(state.project.files.voiceover.content) ? "voiceover" : isMeaningful(state.project.files.styled.content) ? "styled" : "rewrite";
  const result = isMeaningful(state.project.files[resultKey].content) ? stripHeading(state.project.files[resultKey].content) : "";
  const settings = state.workspace.settings;
  const special = String(settings.specialInstructions || "").trim();
  return `
    <div class="stage-heading"><div><span>STEP 02</span><h2>改写成你的账号风格的稿子</h2><p>保留节奏和有效爆点，但重组结构与措辞；允许删减，也允许基于可靠资料补充内容。</p></div><label class="target-length"><span>希望成稿字数</span><div><button data-action="length-down">−</button><input id="targetLength" type="number" min="300" max="10000" step="100" value="${Number(settings.targetLength) || 1800}"><button data-action="length-up">＋</button></div></label></div>
    <div class="rewrite-brief">
      <div class="style-tags"><span>固定要求</span><b>大白话</b><b>知识密度高</b><b>节奏紧</b><b>保留爆点</b><b>大段落</b><b>严格控字数</b></div>
      <button class="special-request" data-action="rewrite-notes"><span>本次特殊要求</span><b>${escapeHtml(special ? (special.length > 46 ? `${special.slice(0, 46)}…` : special) : "点击填写，可留空")}</b><i>编辑</i></button>
    </div>
    <div class="dual-editor rewrite-editors">
      <article class="editor-box reference-box"><header><div><b>整理稿</b><span>本轮改写依据</span></div><em>${textLength(source)} 字</em></header><div class="readonly-copy">${escapeHtml(source || "请先完成原稿整理。").replace(/\n/g,"<br>")}</div></article>
      <div class="between-arrow"><span>深度重构</span><i>→</i></div>
      <article class="editor-box result-edit-box"><header><div><b>改写稿</b><span>可随时手动调整</span></div><em id="rewriteCount">${textLength(result)} 字</em></header><textarea id="rewriteEditor" spellcheck="false" placeholder="AI 改写结果会显示在这里…">${escapeHtml(result)}</textarea><footer><span id="lengthDelta">目标 ${settings.targetLength} 字</span><button data-action="save-rewrite">保存改写稿</button></footer></article>
    </div>`;
}

function optionCards(items, type) {
  if (!items.length) return '<div class="empty-list">完成改写后，AI 会在这里提供多个可选版本。</div>';
  return `<div class="option-list">${items.map((item, index) => `
    <article class="option-card ${item.selected ? "selected" : ""}">
      <button class="option-choice" data-option-type="${type}" data-option-id="${escapeHtml(item.id)}"><span class="option-radio">${item.selected ? "✓" : ""}</span><span class="option-label"><b>${escapeHtml(item.label)}</b><em>选择方案 ${index + 1}</em></span></button>
      <textarea data-option-edit="${type}" data-option-id="${escapeHtml(item.id)}" aria-label="编辑${type === "opening" ? "开头" : "结尾"}方案 ${index + 1}">${escapeHtml(item.text)}</textarea>
    </article>`).join("")}</div>`;
}

function assemblyBody() {
  if (String(state.workspace.openingBody || "").trim()) return state.workspace.openingBody.trim();
  const draft = String(state.workspace.bodyDraft || stripHeading(state.project.files.voiceover.content) || "").trim();
  const paragraphs = draft.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
  // 旧项目没有单独保存“去掉首尾后的正文”。至少按大段边界剥离旧首尾，
  // 新生成的开头结尾会由 AI 明确返回 body，不再依赖这个兼容逻辑。
  if (paragraphs.length < 3) return draft;
  const openingSentences = [...paragraphs[0].matchAll(/[^。！？!?]+[。！？!?]?/gu)].map((match) => match[0].trim()).filter(Boolean);
  const firstBody = openingSentences.length >= 5 ? openingSentences.slice(2).join("") : paragraphs[0];
  return [firstBody, ...paragraphs.slice(1, -1)].filter(Boolean).join("\n\n");
}

function assembledText() {
  const opening = state.workspace.openingOptions.find((item) => item.selected)?.text?.trim() || "";
  const ending = state.workspace.endingOptions.find((item) => item.selected)?.text?.trim() || "";
  return [opening, assemblyBody(), ending].filter(Boolean).join("\n\n");
}

function openingsStage() {
  const opening = state.workspace.openingOptions.find((item) => item.selected);
  const ending = state.workspace.endingOptions.find((item) => item.selected);
  const complete = state.workspace.assembledDraft || assembledText();
  return `
    <div class="stage-heading"><div><span>STEP 03</span><h2>用新开头和新结尾替换原来的首尾</h2><p>AI 会先剥离改写稿原有的开头和结尾，再把你选中的方案接到正文上，不会重复叠加。</p></div></div>
    <div class="option-columns">
      <section><div class="section-label"><span>开头</span><p>前三秒要让人愿意继续听</p></div>${optionCards(state.workspace.openingOptions, "opening")}</section>
      <section><div class="section-label"><span>结尾</span><p>允许升华煽情，但要落到具体内容</p></div>${optionCards(state.workspace.endingOptions, "ending")}</section>
    </div>
    <section class="complete-manuscript"><header><div><b>完整定稿预览</b><span>${opening && ending ? "已用所选首尾替换原稿首尾" : "选择开头和结尾后生成完整稿件"}</span></div><em id="assembledCount">${textLength(complete)} 字</em></header><textarea id="assembledEditor" spellcheck="false" placeholder="选择开头和结尾后，完整稿件会显示在这里…">${escapeHtml(complete)}</textarea><footer><span>这里显示并保存的是完整稿件，你也可以继续手动修改</span><button data-action="assemble">生成并保存完整定稿</button></footer></section>`;
}

function confidenceClass(score) { return score >= 85 ? "high" : score >= 60 ? "medium" : "low"; }

function factsStage() {
  const items = state.workspace.factChecks;
  const resolved = items.filter((item) => item.status !== "pending").length;
  return `
    <div class="stage-heading"><div><span>STEP 04</span><h2>事实核验</h2><p>每个判断都展示来源、置信度和修改级别。适度增强表达可以，但不能改变基本事实。</p></div><div class="review-progress"><b>${resolved}/${items.length}</b><span>已处理</span></div></div>
    <div class="review-legend"><span><i class="must"></i>必须修改</span><span><i class="recommended"></i>建议修改</span><span><i class="optional"></i>可保留表达</span><em>置信度表示当前证据支持程度，不是绝对真伪。</em></div>
    <div class="review-list">${items.length ? items.map((item) => `
      <article class="review-card ${item.status !== "pending" ? "resolved" : ""}">
        <div class="review-top"><span class="level-badge ${item.level}">${item.level === "must" ? "必须修改" : item.level === "recommended" ? "建议修改" : "可以保留"}</span><div class="confidence ${confidenceClass(item.confidence)}"><span>置信度</span><b>${item.confidence}%</b><i><u style="width:${item.confidence}%"></u></i></div></div>
        <blockquote>${escapeHtml(item.claim)}</blockquote><p class="fact-summary">${escapeHtml(item.summary)}</p>
        <div class="suggestion"><span>建议改成</span><p>${escapeHtml(item.suggestion)}</p></div>
        <footer><div class="source-links">${item.sources?.length ? item.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">↗ ${escapeHtml(source.title)}</a>`).join("") : "<span>暂无可靠来源，建议删除断言</span>"}</div><div class="decision-actions"><button data-review="fact" data-id="${item.id}" data-status="kept">仍然保留</button><button class="accept" data-review="fact" data-id="${item.id}" data-status="accepted">接受修改</button></div></footer>
      </article>`).join("") : '<div class="empty-list">运行事实核验后，结果会逐条显示在这里。</div>'}</div>`;
}

function complianceStage() {
  const items = state.workspace.complianceIssues;
  const resolved = items.filter((item) => item.status !== "pending").length;
  return `
    <div class="stage-heading"><div><span>STEP 05</span><h2>违禁词与风险表达</h2><p>规则来自你提供的《短视频违禁词》，系统结合上下文给建议，不做机械替换。</p></div><div class="review-progress"><b>${resolved}/${items.length}</b><span>已处理</span></div></div>
    <div class="source-note"><span>规则库状态</span><b>用户提供 · 待持续核验平台原文</b><p>文档中部分“绝对禁用”和处罚数字暂不作为确定事实，只用于提高检查敏感度。</p></div>
    <div class="compliance-list">${items.length ? items.map((item) => `
      <article class="compliance-item ${item.status !== "pending" ? "resolved" : ""}"><div class="risk-marker ${item.severity}">!</div><div class="risk-content"><div><span>${escapeHtml(item.category)}</span><em>${item.severity === "high" ? "高风险" : "中风险"}</em></div><p class="replacement"><del>${escapeHtml(item.original)}</del><i>→</i><ins>${escapeHtml(item.suggestion)}</ins></p><small>${escapeHtml(item.reason)}</small></div><div class="decision-actions"><button data-review="compliance" data-id="${item.id}" data-status="kept">不改</button><button class="accept" data-review="compliance" data-id="${item.id}" data-status="accepted">接受</button></div></article>`).join("") : '<div class="empty-list">完成成稿后，系统会逐句标出需要处理的风险表达。</div>'}</div>`;
}

function phraseGrams(value) {
  const normalized = String(value || "").replace(/[\s，。！？；：、,.!?;:“”"'（）()《》·—-]/gu, "");
  const grams = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) grams.add(normalized.slice(index, index + 2));
  return grams;
}

function findBestRange(text, quote) {
  const exact = text.indexOf(quote);
  if (exact >= 0) return { start: exact, end: exact + quote.length, approximate: false };
  const wanted = phraseGrams(quote);
  if (!wanted.size) return null;
  const sentences = [...text.matchAll(/[^。！？!?\n]+[。！？!?]?/gu)];
  let best = null;
  for (const match of sentences) {
    const actual = phraseGrams(match[0]);
    const shared = [...wanted].filter((gram) => actual.has(gram)).length;
    const score = shared / Math.max(1, Math.min(wanted.size, actual.size));
    if (!best || score > best.score) best = { start: match.index, end: match.index + match[0].length, score, shared, approximate: true };
  }
  return best?.shared >= 2 && best.score >= 0.28 ? best : null;
}

function annotatedManuscript(text, facts, risks) {
  const candidates = [
    ...facts.map((item, index) => ({ key: `fact:${item.id}`, quote: item.claim, label: `事实 ${index + 1}`, kind: "fact", level: item.level })),
    ...risks.map((item, index) => ({ key: `compliance:${item.id}`, quote: item.original, label: `风险 ${index + 1}`, kind: "risk", level: item.severity }))
  ].filter((item) => item.quote).map((item) => ({ ...item, range: findBestRange(text, item.quote) })).filter((item) => item.range).sort((a, b) => Number(a.range.approximate) - Number(b.range.approximate) || b.quote.length - a.quote.length);
  const ranges = [];
  for (const item of candidates) {
    const { start, end, approximate } = item.range;
    if (!ranges.some((range) => start < range.end && end > range.start)) ranges.push({ ...item, start, end, approximate });
  }
  ranges.sort((a, b) => a.start - b.start);
  let cursor = 0;
  let html = "";
  for (const range of ranges) {
    html += escapeHtml(text.slice(cursor, range.start));
    html += `<mark class="inline-review-mark ${range.kind} ${escapeHtml(range.level)} ${range.approximate ? "approximate" : ""}" data-review-highlight="${escapeHtml(range.key)}" title="${escapeHtml(range.label)}${range.approximate ? " · 相似句定位" : ""}"><sup>${range.kind === "fact" ? "F" : "R"}</sup>${escapeHtml(text.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }
  html += escapeHtml(text.slice(cursor));
  return html || '<span class="annotated-empty">请先组合并保存完整稿件。</span>';
}

function verdictBadge(item) {
  if (!item.verdict) return "";
  const map = {
    supported: { cls: "verdict-supported", icon: "✓", label: "证据支持" },
    refuted: { cls: "verdict-refuted", icon: "✕", label: "证据反驳" },
    nei: { cls: "verdict-nei", icon: "?", label: "证据不足" }
  };
  const meta = map[item.verdict];
  if (!meta) return "";
  const correct = item.verdict === "refuted" && item.correctStatement
    ? `<div class="verdict-correct"><span>有据可查的说法</span>${escapeHtml(item.correctStatement)}</div>` : "";
  return `<div class="evidence-verdict ${meta.cls}">
    <div class="verdict-head"><b>${meta.icon} ${meta.label}</b><button class="verdict-clear" data-verdict-clear data-id="${escapeHtml(item.id)}" title="清除该判断">×</button></div>
    <p>${escapeHtml(item.verdictReasoning || "")}</p>${correct}
  </div>`;
}

function sourceSearchStatus(item) {
  const status = state.sourceSearches[item.id];
  if (!status) return "";
  return `<div class="source-search-status ${escapeHtml(status.status || "")}" data-source-search-status="${escapeHtml(item.id)}">${escapeHtml(status.message || "")}</div>`;
}

function reviewStage() {
  const manuscript = isMeaningful(state.project.files.voiceover.content) ? stripHeading(state.project.files.voiceover.content) : "";
  const facts = state.workspace.factChecks || [];
  const risks = state.workspace.complianceIssues || [];
  const resolved = [...facts, ...risks].filter((item) => item.status !== "pending").length;
  const missingSourceCount = facts.filter((item) => !item.sources?.length).length;
  const factContent = facts.length ? facts.map((item, index) => `
    <article class="review-card ${item.status !== "pending" ? "resolved" : ""}" data-review-card="fact:${escapeHtml(item.id)}">
      <div class="review-top"><div><span class="review-index">F${index + 1}</span><span class="level-badge ${item.level}">${item.level === "must" ? "必须修改" : item.level === "recommended" ? "建议修改" : "可以保留"}</span></div><div class="confidence ${confidenceClass(item.confidence)}"><span>置信度</span><b>${item.confidence}%</b><i><u style="width:${item.confidence}%"></u></i></div></div>
      <blockquote>${escapeHtml(item.claim)}</blockquote><p class="fact-summary">${escapeHtml(item.summary)}</p>${verdictBadge(item)}
      <div class="suggestion"><div><span>建议改成</span><small>选中文字即可让 AI 修改</small></div><textarea data-suggestion-edit="fact" data-id="${escapeHtml(item.id)}" aria-label="编辑事实核验建议">${escapeHtml(item.suggestion)}</textarea></div>
      <footer><div class="source-query-row"><label>检索词</label><input type="text" class="source-query-input" data-source-query data-id="${escapeHtml(item.id)}" value="${escapeHtml(item.sourceQuery || "")}" placeholder="AI 提炼的关键词，可手动修改后重搜" spellcheck="false"><button class="source-query-search" data-source-search data-id="${escapeHtml(item.id)}" title="用当前检索词搜索权威来源">⌕ 搜索</button></div>${sourceSearchStatus(item)}<div class="source-footer-row"><div class="source-links">${item.sources?.length ? item.sources.map((source, sourceIndex) => `<button data-source-preview data-kind="fact" data-id="${escapeHtml(item.id)}" data-source-index="${sourceIndex}" data-url="${escapeHtml(source.url)}" data-title="${escapeHtml(source.title)}" data-query="${escapeHtml(item.claim)}" data-excerpt="${escapeHtml(source.excerpt || "")}">▣ ${source.evidence ? "已缓存证据" : "预览并定位"}：${escapeHtml(source.title)}</button>`).join("") + `<button class="ai-verify-button" data-ai-verify data-id="${escapeHtml(item.id)}" title="让 AI 阅读来源正文，判断证据是否支持该断言">⚖ ${item.verdict ? "重新验证" : "AI 验证证据"}</button>` : `<span class="source-empty-hint">暂无可靠来源，修改检索词后点搜索，或考虑删除这条断言</span>`}</div><div class="decision-actions"><button class="${item.status === "pending" ? "selected-decision" : ""}" data-review="fact" data-id="${item.id}" data-status="pending">重新考虑</button><button class="${item.status === "kept" ? "selected-decision" : ""}" data-review="fact" data-id="${item.id}" data-status="kept">仍然保留</button><button class="accept ${item.status === "accepted" ? "selected-decision" : ""}" data-review="fact" data-id="${item.id}" data-status="accepted">接受并替换</button></div></div></footer>
    </article>`).join("") : '<div class="empty-list">点击右上角“检查整合稿”后，事实判断会显示在这里。</div>';
  const riskContent = risks.length ? risks.map((item, index) => `
    <article class="compliance-item ${item.status !== "pending" ? "resolved" : ""}" data-review-card="compliance:${escapeHtml(item.id)}"><div class="risk-marker ${item.severity}">R${index + 1}</div><div class="risk-content"><div><span>${escapeHtml(item.category)}</span><em>${item.severity === "high" ? "高风险" : "中风险"}</em></div><p class="replacement"><del>${escapeHtml(item.original)}</del><i>→</i><span>建议表达 · 选中文字可让 AI 修改</span></p><div class="risk-suggestion"><textarea data-suggestion-edit="compliance" data-id="${escapeHtml(item.id)}" aria-label="编辑风险表达建议">${escapeHtml(item.suggestion)}</textarea></div><small>${escapeHtml(item.reason)}</small></div><div class="decision-actions"><button class="${item.status === "pending" ? "selected-decision" : ""}" data-review="compliance" data-id="${item.id}" data-status="pending">重新考虑</button><button class="${item.status === "kept" ? "selected-decision" : ""}" data-review="compliance" data-id="${item.id}" data-status="kept">不改</button><button class="accept ${item.status === "accepted" ? "selected-decision" : ""}" data-review="compliance" data-id="${item.id}" data-status="accepted">接受并替换</button></div></article>`).join("") : '<div class="empty-list">完成整合稿后，风险表达会结合全文显示在这里。</div>';
  return `
    <div class="stage-heading"><div><span>STEP 04</span><h2>在整合好的稿件上做全文审校</h2><p>左边始终保留完整上下文；右边同时看事实来源和风险表达，接受建议会直接替换到成稿。</p></div><div class="review-heading-actions">${missingSourceCount ? `<button class="small-button source-batch-button" data-action="search-all-sources">⌕ 为 ${missingSourceCount} 条核验补来源</button>` : ""}<div class="review-progress"><b>${resolved}/${facts.length + risks.length}</b><span>已处理</span></div></div></div>
    <div class="review-legend"><span><i class="must"></i>必须修改</span><span><i class="recommended"></i>建议修改</span><span><i class="optional"></i>可保留表达</span><em>置信度是证据支持程度，不是绝对真伪。</em></div>
    <div class="review-workbench">
      <article class="editor-box review-manuscript"><header><div><b>整合后的完整稿件</b><span>悬停标记即可对应右侧建议</span></div><div class="review-view-switch"><button class="${state.reviewMode === "annotated" ? "active" : ""}" data-action="review-annotated">标注阅读</button><button class="${state.reviewMode === "edit" ? "active" : ""}" data-action="review-edit">手动修改</button><em id="reviewCount">${textLength(manuscript)} 字</em></div></header>${state.reviewMode === "edit" ? `<textarea id="reviewEditor" spellcheck="false" placeholder="请先在“开头结尾”中组合成稿…">${escapeHtml(manuscript)}</textarea>` : `<div class="annotated-copy" id="annotatedCopy">${annotatedManuscript(manuscript, facts, risks)}</div>`}<footer><span>黄色为事实点，红色为风险表达</span>${state.reviewMode === "edit" ? '<button data-action="save-review">保存全文</button>' : '<button data-action="review-edit">进入修改</button>'}</footer></article>
      <aside class="combined-review">
        <section><div class="combined-review-title"><div><b>事实核验</b><span>来源、置信度与修改级别</span></div><em>${facts.length} 条</em></div><div class="review-list">${factContent}</div></section>
        <section><div class="combined-review-title"><div><b>违禁词与风险表达</b><span>依据你提供的规则库，结合全文判断</span></div><em>${risks.length} 条</em></div><div class="source-note"><span>规则库</span><b>用户提供</b><p>平台规则会变化，建议仍以发布时官方规则为准。</p></div><div class="compliance-list">${riskContent}</div></section>
      </aside>
    </div>`;
}

function selectableGroup(title, subtitle, type, items) {
  return `<section class="publish-group"><div class="section-label"><span>${title}</span><p>${subtitle} · 可直接修改</p></div><div class="publish-options">${items.length ? items.map((item, index) => `<article class="publish-option ${state.workspace.decisions[type] === index ? "selected" : ""}"><button data-publish-type="${type}" data-index="${index}" aria-label="选择第 ${index + 1} 项"><span>${index + 1}</span><i>${state.workspace.decisions[type] === index ? "✓" : ""}</i></button><textarea data-publish-edit="${type}" data-index="${index}" aria-label="编辑${title} ${index + 1}">${escapeHtml(item)}</textarea></article>`).join("") : '<div class="empty-list">暂无选项</div>'}</div></section>`;
}

function learningPanel() {
  const preferences = state.accountMemory.preferences || [];
  const candidates = state.workspace.learningCandidates || [];
  return `<section class="publish-group learning-group"><div class="section-label"><span>让 AI 学会你的改稿习惯</span><p>先分析，再由你选择哪些偏好进入账号长期记忆</p></div>
    <div class="learning-card"><div><b>当前已积累 ${preferences.length} 条账号偏好</b><p>每一条都在下面明示；可以单独删除，也可以全部清空。</p><p class="memory-location">本机保存位置：accounts/default/memory/editorial_memory.json</p></div><div class="learning-actions"><button data-action="learn-project">分析本篇偏好</button>${preferences.length ? '<button class="memory-clear" data-action="clear-memory">清空全部</button>' : ""}</div></div>
    ${preferences.length ? `<div class="memory-preferences">${preferences.map((preference, index) => `<span>${escapeHtml(preference)}<button data-memory-remove="${index}" aria-label="删除这条偏好">×</button></span>`).join("")}</div>` : '<div class="empty-list compact">账号记忆目前为空。</div>'}
    ${candidates.length ? `<div class="learning-candidates"><header><div><b>从本篇定稿发现的候选偏好</b><span>${escapeHtml(state.workspace.learningSummary || "勾选后才会放入账号记忆")}</span></div><button data-action="commit-learning">将选中项放入记忆</button></header>${candidates.map((candidate, index) => `<label><input type="checkbox" data-learning-candidate="${index}" ${candidate.selected !== false ? "checked" : ""}><span>${escapeHtml(candidate.text)}</span></label>`).join("")}</div>` : ""}
  </section>`;
}

function publishStage() {
  const publish = state.workspace.publish;
  const pronunciations = publish.pronunciations || [];
  return `
    <div class="stage-heading"><div><span>STEP 05</span><h2>选择发布素材</h2><p>选中的标题会同步成为左侧稿件标题，再把描述、标签和评论区话术组成发布方案。</p></div><button class="outline-action" data-action="copy-package">复制已选方案</button></div>
    <div class="publish-grid">
      ${selectableGroup("劲爆标题", "可以吸引人，但正文必须接得住", "title", publish.titles || [])}
      ${selectableGroup("视频描述", "交代内容价值，不重复标题", "description", publish.descriptions || [])}
      ${selectableGroup("评论区互动", "帮助观众给出具体回应", "comment", publish.comments || [])}
      <section class="publish-group"><div class="section-label"><span>视频标签</span><p>点击选择，文字可修改</p></div><div class="tag-cloud">${(publish.tags || []).map((tag, index) => `<label class="${(state.workspace.decisions.tags || []).includes(tag) ? "selected" : ""}"><button data-tag="${escapeHtml(tag)}" aria-label="选择标签 ${escapeHtml(tag)}">#</button><input data-tag-edit data-index="${index}" value="${escapeHtml(tag)}" /></label>`).join("")}</div></section>
      <section class="publish-group pronunciation-group"><div class="section-label"><span>易读错字词 · 拼音提示</span><p>录口播前快速扫一遍，也可手动修改</p></div><div class="pronunciation-list">${pronunciations.length ? pronunciations.map((item, index) => `<div class="pronunciation-item"><input data-pronunciation-edit="word" data-index="${index}" value="${escapeHtml(item.word)}" aria-label="易错词"><input data-pronunciation-edit="pinyin" data-index="${index}" value="${escapeHtml(item.pinyin)}" aria-label="拼音"><input data-pronunciation-edit="note" data-index="${index}" value="${escapeHtml(item.note || "")}" aria-label="读音提示"></div>`).join("") : '<div class="empty-list">生成发布素材后，AI 会在这里标出人名、地名、多音字和少见字的拼音。</div>'}</div></section>
      ${learningPanel()}
    </div>`;
}

const renderers = { source: sourceStage, rewrite: rewriteStage, openings: openingsStage, review: reviewStage, publish: publishStage };

function bindStageEvents() {
  const sourceEditor = $("#sourceEditor");
  const correctedEditor = $("#correctedEditor");
  const rewriteEditor = $("#rewriteEditor");
  const reviewEditor = $("#reviewEditor");
  const assembledEditor = $("#assembledEditor");
  sourceEditor?.addEventListener("input", () => {
    state.sourceDirty = true;
    $("#sourceCount").textContent = `${textLength(sourceEditor.value)} 字`;
    els.saveState.textContent = "原稿有未保存修改";
    scheduleMetadata();
  });
  correctedEditor?.addEventListener("input", () => { state.correctedDirty = true; $("#correctedCount").textContent = `${textLength(correctedEditor.value)} 字`; els.saveState.textContent = "整理稿有未保存修改"; });
  rewriteEditor?.addEventListener("input", () => { state.rewriteDirty = true; $("#rewriteCount").textContent = `${textLength(rewriteEditor.value)} 字`; updateLengthDelta(); els.saveState.textContent = "改写稿有未保存修改"; });
  reviewEditor?.addEventListener("input", () => { state.rewriteDirty = true; $("#reviewCount").textContent = `${textLength(reviewEditor.value)} 字`; els.saveState.textContent = "整合稿有未保存修改"; });
  assembledEditor?.addEventListener("input", () => {
    state.workspace.assembledDraft = assembledEditor.value;
    $("#assembledCount").textContent = `${textLength(assembledEditor.value)} 字`;
    els.saveState.textContent = "完整定稿有未保存修改";
    queueWorkspaceSave();
  });
  $$('[data-option-edit]', els.stageContent).forEach((editor) => editor.addEventListener("input", () => {
    const list = editor.dataset.optionEdit === "opening" ? state.workspace.openingOptions : state.workspace.endingOptions;
    const item = list.find((entry) => entry.id === editor.dataset.optionId);
    if (item) { item.text = editor.value; queueWorkspaceSave(); }
  }));
  $$('[data-publish-edit]', els.stageContent).forEach((editor) => editor.addEventListener("input", () => {
    const type = editor.dataset.publishEdit;
    const list = type === "comment" ? state.workspace.publish.comments : state.workspace.publish[`${type}s`];
    if (list) { list[Number(editor.dataset.index)] = editor.value; queueWorkspaceSave(); }
  }));
  $$('[data-tag-edit]', els.stageContent).forEach((editor) => editor.addEventListener("input", () => {
    const index = Number(editor.dataset.index);
    const oldTag = state.workspace.publish.tags[index];
    state.workspace.publish.tags[index] = editor.value.replace(/^#/, "").trim();
    const selectButton = editor.closest("label")?.querySelector("[data-tag]");
    if (selectButton) selectButton.dataset.tag = state.workspace.publish.tags[index];
    const selected = new Set(state.workspace.decisions.tags || []);
    if (selected.delete(oldTag)) selected.add(state.workspace.publish.tags[index]);
    state.workspace.decisions.tags = [...selected];
    queueWorkspaceSave();
  }));
  $$('[data-pronunciation-edit]', els.stageContent).forEach((editor) => editor.addEventListener("input", () => {
    const item = state.workspace.publish.pronunciations?.[Number(editor.dataset.index)];
    if (item) { item[editor.dataset.pronunciationEdit] = editor.value; queueWorkspaceSave(); }
  }));
  $$('[data-suggestion-edit]', els.stageContent).forEach((editor) => editor.addEventListener("input", () => {
    const list = editor.dataset.suggestionEdit === "fact" ? state.workspace.factChecks : state.workspace.complianceIssues;
    const item = list.find((entry) => entry.id === editor.dataset.id);
    if (item) { item.suggestion = editor.value; queueWorkspaceSave(); }
  }));
  $$('[data-source-query]', els.stageContent).forEach((input) => input.addEventListener("change", () => {
    const item = state.workspace.factChecks?.find((entry) => entry.id === input.dataset.id);
    if (item) { item.sourceQuery = input.value.trim(); queueWorkspaceSave(); }
  }));
}

function showSelectionAssistant(selection) {
  state.selectionEdit = selection;
  const panel = $("#selectionAssistant");
  const preview = $("#selectionPreview");
  if (!panel || !preview) return;
  preview.textContent = selection.selected.length > 180 ? `${selection.selected.slice(0, 180)}…` : selection.selected;
  panel.hidden = false;
  $("#selectionStatus").textContent = `已选择 ${textLength(selection.selected)} 字，只替换这一处`;
}

function bindSelectionEditing() {
  $$("textarea:not(#selectionInstruction)", els.stageContent).forEach((editor) => {
    const capture = () => {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      if (!Number.isInteger(start) || end - start < 2) return;
      showSelectionAssistant({ type: "editor", editor, start, end, selected: editor.value.slice(start, end), before: editor.value.slice(Math.max(0, start - 700), start), after: editor.value.slice(end, end + 700) });
    };
    editor.addEventListener("mouseup", capture);
    editor.addEventListener("keyup", (event) => { if (event.shiftKey || ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) capture(); });
  });
  $("#annotatedCopy")?.addEventListener("mouseup", () => {
    const selection = window.getSelection();
    const selected = selection?.toString() || "";
    if (selected.trim().length < 2 || !$("#annotatedCopy").contains(selection.anchorNode)) return;
    const manuscript = stripHeading(state.project.files.voiceover.content);
    const start = manuscript.indexOf(selected);
    if (start < 0) return;
    showSelectionAssistant({ type: "manuscript", start, end: start + selected.length, selected, before: manuscript.slice(Math.max(0, start - 700), start), after: manuscript.slice(start + selected.length, start + selected.length + 700) });
  });
  $("#selectionInstruction")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); runSelectionEdit(); }
  });
}

async function runSelectionEdit() {
  const selection = state.selectionEdit;
  const instruction = String($("#selectionInstruction")?.value || "").trim();
  if (!selection || !instruction || state.selectionRunning) return showToast("请先选中文字，再写明希望怎么改");
  if (!hasAIKey()) return openAISettings();
  state.selectionRunning = true;
  const button = $('[data-action="selection-run"]');
  const status = $("#selectionStatus");
  if (button) { button.disabled = true; button.textContent = "AI 正在修改…"; }
  if (status) status.textContent = "正在结合前后文处理选区";
  try {
    const data = await request("/api/ai/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionKey() ? { "X-AI-Api-Key": sessionKey() } : {}),
        ...(searchKey() ? { "X-Search-Api-Key": searchKey() } : {})
      },
      body: JSON.stringify({ provider: selectedProvider(), stage: "selection", model: selectedModel(), payload: { ...currentAIPayload(), ...selection, editor: undefined, message: instruction } })
    });
    const replacement = String(data.result.replacement || "");
    if (selection.type === "editor" && selection.editor?.isConnected) {
      const editor = selection.editor;
      const current = editor.value;
      const start = current.slice(selection.start, selection.end) === selection.selected ? selection.start : current.indexOf(selection.selected);
      if (start < 0) throw new Error("选中文字已经变化，请重新选择");
      editor.value = `${current.slice(0, start)}${replacement}${current.slice(start + selection.selected.length)}`;
      editor.setSelectionRange(start, start + replacement.length);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      const manuscript = stripHeading(state.project.files.voiceover.content);
      const start = manuscript.indexOf(selection.selected);
      if (start < 0) throw new Error("选中文字已经变化，请重新选择");
      const updated = `${manuscript.slice(0, start)}${replacement}${manuscript.slice(start + selection.selected.length)}`;
      await saveFile("voiceover", `# 最终口播稿\n\n${updated.trim()}\n`);
      state.rewriteDirty = false;
    }
    state.workspace.conversation ||= [];
    state.workspace.conversation.push({ role: "user", stage: state.activeStage, text: `[选区修改] ${instruction}`, at: new Date().toISOString() });
    state.workspace.conversation.push({ role: "assistant", stage: state.activeStage, text: data.result.reply, at: new Date().toISOString() });
    await saveWorkspace();
    state.selectionEdit = null;
    if (selection.type === "manuscript") renderStage();
    else $("#selectionAssistant").hidden = true;
    showToast("已原位替换选中的文字");
  } catch (error) { showToast(error.message); }
  finally {
    state.selectionRunning = false;
    const currentButton = $('[data-action="selection-run"]');
    if (currentButton) {
      currentButton.disabled = false;
      currentButton.textContent = "AI 修改选中内容";
    }
  }
}

async function goNextStage() {
  if (state.activeStage === "source") {
    if (state.sourceDirty) await handleStageAction("save-source");
    if (state.correctedDirty) await handleStageAction("save-corrected");
    if (!isMeaningful(state.project.files.corrected.content)) return showToast("请先让 AI 整理原稿，或手动填写并保存整理稿");
  } else if (state.activeStage === "rewrite") {
    if (state.rewriteDirty) await handleStageAction("save-rewrite");
    if (!isMeaningful(state.project.files.voiceover.content)) return showToast("请先生成或填写改写稿");
  } else if (state.activeStage === "openings") {
    if (!state.workspace.openingOptions.some((item) => item.selected) || !state.workspace.endingOptions.some((item) => item.selected)) return showToast("请先各选一个开头和结尾");
    await handleStageAction("assemble");
  } else if (state.activeStage === "review" && state.rewriteDirty && $("#reviewEditor")) {
    await handleStageAction("save-review");
  }
  const next = stageOrder[stageOrder.indexOf(state.activeStage) + 1];
  if (!next) return;
  state.activeStage = next;
  state.workspace.currentStage = next;
  await saveWorkspace();
  renderStage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateLengthDelta() {
  const editor = $("#rewriteEditor");
  const label = $("#lengthDelta");
  if (!editor || !label) return;
  const current = textLength(editor.value), target = Number(state.workspace.settings.targetLength) || 0;
  label.textContent = target ? `目标 ${target} 字 · ${current > target ? `超出 ${current-target}` : `还差 ${target-current}`} 字` : `${current} 字`;
}

function stageHasOutput(stage) {
  if (stage === "source") return isMeaningful(state.project.files.corrected.content);
  if (stage === "rewrite") return isMeaningful(state.project.files.voiceover.content) || isMeaningful(state.project.files.styled.content);
  if (stage === "openings") return Boolean(state.workspace.openingOptions?.length && state.workspace.endingOptions?.length);
  if (stage === "review") return Boolean(state.workspace.factChecks?.length || state.workspace.complianceIssues?.length);
  if (stage === "publish") return Boolean(state.workspace.publish?.titles?.length);
  return false;
}

function stageActionLabel(stage) {
  const labels = {
    source: ["AI 整理原稿", "AI 重新整理原稿"],
    rewrite: ["AI 生成改写稿", "AI 重新生成改写稿"],
    openings: ["AI 生成开头结尾", "AI 重新生成开头结尾"],
    review: ["AI 校验全文", "AI 重新校验全文"],
    publish: ["AI 生成发布素材", "AI 重新生成发布素材"]
  };
  return labels[stage]?.[stageHasOutput(stage) ? 1 : 0] || "AI 生成";
}

function progressMarkup() {
  const progress = state.ai.progress;
  const visible = progress && progress.stage === state.activeStage;
  const percent = visible ? Math.max(0, Math.min(100, Number(progress.percent) || 0)) : 0;
  return `<section class="ai-progress-panel ${visible ? "show" : ""} ${progress?.status === "complete" ? "complete" : ""} ${progress?.status === "error" ? "error" : ""}" id="aiProgressPanel" aria-live="polite">
    <div class="ai-progress-head"><span class="ai-progress-orb">✦</span><div><b id="aiProgressLabel">${escapeHtml(visible ? progress.label : "正在准备")}</b><small id="aiProgressDetail">${escapeHtml(visible ? progress.detail || "" : "")}</small></div><em id="aiProgressElapsed">${visible ? `${Number(progress.elapsed) || 0} 秒` : ""}</em></div>
    <div class="ai-progress-track"><i id="aiProgressBar" style="width:${percent}%"></i></div>
  </section>`;
}

function updateAIProgressUI() {
  const progress = state.ai.progress;
  const panel = $("#aiProgressPanel");
  if (panel) {
    const visible = progress && progress.stage === state.activeStage;
    panel.classList.toggle("show", Boolean(visible));
    panel.classList.toggle("complete", progress?.status === "complete");
    panel.classList.toggle("error", progress?.status === "error");
    if (visible) {
      $("#aiProgressLabel").textContent = progress.label;
      $("#aiProgressDetail").textContent = progress.detail || "";
      $("#aiProgressElapsed").textContent = `${Number(progress.elapsed) || 0} 秒`;
      $("#aiProgressBar").style.width = `${Math.max(0, Math.min(100, Number(progress.percent) || 0))}%`;
    }
  }
  const actionButton = $('[data-action="run-stage-ai"]', els.stageContent);
  if (actionButton) {
    actionButton.disabled = state.ai.running;
    actionButton.classList.toggle("loading", state.ai.running);
    actionButton.innerHTML = `<span class="spark">✦</span> ${escapeHtml(state.ai.running ? "AI 处理中…" : stageActionLabel(state.activeStage))}`;
  }
  els.generateButton.disabled = state.ai.running;
}

function setAIProgress(values) {
  const previous = state.ai.progress || {};
  state.ai.progress = { ...previous, ...values };
  updateAIProgressUI();
}

function renderStage() {
  renderProjectHeader();
  const currentIndex = stageOrder.indexOf(state.activeStage);
  const nextStage = stageOrder[currentIndex + 1];
  els.stageContent.innerHTML = `
    <div class="stage-assistant-bar">
      <div><span>本环节要求</span><p>${escapeHtml(state.workspace.settings.stageInstructions?.[state.activeStage] || "没有额外要求，使用账号固定规则")}</p></div>
      <button data-action="stage-instructions">＋ 补充本环节要求</button>
    </div>
    <div class="stage-primary-actions"><div><b>${stageHasOutput(state.activeStage) ? "已有结果，可随时重新生成" : "准备好后从这里开始"}</b><span>AI 会展示当前正在进行的处理步骤</span></div><button class="stage-ai-action primary" data-action="run-stage-ai"><span class="spark">✦</span> ${stageActionLabel(state.activeStage)}</button></div>
    ${progressMarkup()}${renderers[state.activeStage]()}
    <aside class="selection-assistant" id="selectionAssistant" hidden>
      <div><span>已选中文字</span><button data-action="selection-cancel" aria-label="关闭选区编辑">×</button></div>
      <blockquote id="selectionPreview"></blockquote>
      <label>告诉 AI 这段怎么改<input id="selectionInstruction" placeholder="例如：更口语一点；保留爆点但说得严谨；缩短一半…"></label>
      <footer><em id="selectionStatus">只会替换选中的文字</em><button data-action="selection-run">AI 修改选中内容</button></footer>
    </aside>
    <div class="stage-footer-actions"><div><b>第 ${currentIndex + 1} 步 · ${stageNames[state.activeStage]}</b><span>每一步都可以手动修改后再继续</span></div>${nextStage ? `<button class="stage-next-action" data-action="next-stage">下一步：${stageNames[nextStage]} →</button>` : '<button class="stage-next-action" data-action="copy-package">复制发布方案</button>'}</div>`;
  bindStageEvents();
  bindSelectionEditing();
  updateLengthDelta();
  updateAIProgressUI();
}

function renderProject() {
  renderProjects();
  renderStage();
}

function openProjectManager(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  els.manageProjectId.value = project.id;
  els.manageTitle.value = project.title;
  els.manageDomain.value = project.domain || "其他";
  els.manageTags.value = (project.tags || []).join("，");
  els.projectManageDialog.showModal();
}

async function updateProjectMetadata(id, values) {
  const data = await request(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(values)
  });
  state.projects = (await request("/api/projects")).projects;
  if (state.project?.id === id) {
    if (state.domainFilter !== "全部" && values.domain !== state.domainFilter) state.domainFilter = "全部";
    const activeStage = state.activeStage;
    state.project = data.project;
    state.workspace = loadWorkspace(data.project);
    state.activeStage = renderers[activeStage] ? activeStage : "source";
    renderProject();
  } else renderProjects();
  return data.project;
}

async function selectProject(id) {
  if ((state.sourceDirty || state.correctedDirty || state.rewriteDirty) && !confirm("当前内容还没有保存，确定切换项目吗？")) return;
  try {
    const data = await request(`/api/projects/${encodeURIComponent(id)}`);
    state.project = data.project;
    state.workspace = loadWorkspace(data.project);
    state.activeStage = state.workspace.currentStage || "source";
    if (["facts", "compliance"].includes(state.activeStage)) state.activeStage = "review";
    if (!renderers[state.activeStage]) state.activeStage = "source";
    state.sourceDirty = state.correctedDirty = state.rewriteDirty = false;
    renderProject();
    els.sidebar.classList.remove("open");
  } catch (error) { showToast(error.message); }
}

async function decide(kind, id, status) {
  const list = kind === "fact" ? state.workspace.factChecks : state.workspace.complianceIssues;
  const item = list.find((entry) => entry.id === id);
  if (!item) return;
  let replaced = false;
  const original = kind === "fact" ? item.claim : item.original;
  const current = $("#reviewEditor")?.value || stripHeading(state.project.files.voiceover.content);
  if (status === "accepted") {
    const suggestion = item.suggestion;
    const replaceFrom = item.appliedSuggestion && current.includes(item.appliedSuggestion) ? item.appliedSuggestion : original;
    if (replaceFrom && suggestion && current.includes(replaceFrom)) {
      const updated = current.split(replaceFrom).join(suggestion);
      await saveFile("voiceover", `# 最终口播稿\n\n${updated.trim()}\n`);
      replaced = true;
      item.appliedSuggestion = suggestion;
      state.rewriteDirty = false;
    }
  } else if (item.appliedSuggestion && original && current.includes(item.appliedSuggestion)) {
    const updated = current.split(item.appliedSuggestion).join(original);
    await saveFile("voiceover", `# 最终口播稿\n\n${updated.trim()}\n`);
    item.appliedSuggestion = "";
    replaced = true;
  }
  item.status = status;
  await saveWorkspace();
  renderStage();
  showToast(status === "accepted" ? (replaced ? "已接受，并替换到完整稿件" : "建议已接受，请按上下文手动调整") : status === "pending" ? "已恢复为待决定，可继续修改" : (replaced ? "已撤销替换并恢复原文" : "已记录保留原文"));
}

function openProcess(key = "extraction") {
  els.processNav.innerHTML = processFiles.map(([fileKey, label]) => `<button class="${fileKey === key ? "active" : ""}" data-process-file="${fileKey}">${label}${state.project.stages[fileKey] ? " ·" : ""}</button>`).join("");
  els.processContent.innerHTML = markdown(state.project.files[key]?.content || "# 暂无内容\n\n这个阶段还没有开始。");
  $$('[data-process-file]', els.processNav).forEach((button) => button.addEventListener("click", () => openProcess(button.dataset.processFile)));
  if (!els.processDialog.open) els.processDialog.showModal();
}

async function handleStageAction(action) {
  try {
    if (action === "search-all-sources") {
      const button = $('[data-action="search-all-sources"]');
      if (button) await searchAllFactSources(button);
    } else if (action === "save-source") {
      const content = withSourceBody(state.project.files.original.content, $("#sourceEditor").value);
      await saveFile("original", content); state.sourceDirty = false; showToast("原稿已保存"); scheduleMetadata(0);
    } else if (action === "save-corrected") {
      const corrected = formatCorrectedDraft($("#correctedEditor").value);
      await saveFile("corrected", `# 整理后的原始稿\n\n${corrected}\n`); state.correctedDirty = false; renderStage(); showToast("整理稿已按大段落格式保存");
    } else if (action === "save-rewrite") {
      const body = $("#rewriteEditor").value.trim();
      await saveFile("voiceover", `# 最终口播稿\n\n${body}\n`);
      state.workspace.bodyDraft = body;
      await saveWorkspace();
      state.rewriteDirty = false; showToast("改写稿已保存");
    } else if (action === "save-review") {
      await saveFile("voiceover", `# 最终口播稿\n\n${$("#reviewEditor").value.trim()}\n`); state.rewriteDirty = false; showToast("完整稿件已保存");
    } else if (action === "review-edit") {
      state.reviewMode = "edit"; renderStage();
    } else if (action === "review-annotated") {
      const editor = $("#reviewEditor");
      if (editor && state.rewriteDirty) {
        await saveFile("voiceover", `# 最终口播稿\n\n${editor.value.trim()}\n`);
        state.rewriteDirty = false;
      }
      state.reviewMode = "annotated"; renderStage();
    } else if (action === "length-down" || action === "length-up") {
      const delta = action === "length-up" ? 100 : -100;
      state.workspace.settings.targetLength = Math.max(300, Math.min(10000, Number(state.workspace.settings.targetLength || 1800) + delta));
      await saveWorkspace(); renderStage();
    } else if (action === "assemble") {
      const opening = state.workspace.openingOptions.find((item) => item.selected);
      const ending = state.workspace.endingOptions.find((item) => item.selected);
      if (!opening || !ending) return showToast("请先各选一个开头和结尾");
      const complete = ($("#assembledEditor")?.value || state.workspace.assembledDraft || assembledText()).trim();
      state.workspace.assembledDraft = complete;
      await saveFile("voiceover", `# 最终口播稿\n\n${complete}\n`);
      await saveWorkspace();
      renderStage();
      showToast(`完整定稿已保存 · ${textLength(complete)} 字`);
    } else if (action === "more-options") await runAIStage({ stageOverride: "openings", bypassPrompt: true });
    else if (action === "rewrite-notes" || action === "stage-instructions") openStagePrompt(state.activeStage);
    else if (action === "open-chat") openChat();
    else if (action === "selection-cancel") { state.selectionEdit = null; const panel = $("#selectionAssistant"); if (panel) panel.hidden = true; }
    else if (action === "selection-run") await runSelectionEdit();
    else if (action === "run-stage-ai") {
      await runAIStage({ bypassPrompt: true });
    }
    else if (action === "next-stage") await goNextStage();
    else if (action === "learn-project") await learnFromProject();
    else if (action === "commit-learning") await commitLearning();
    else if (action === "clear-memory") await clearMemory();
    else if (action === "copy-package") await copyPackage();
    els.saveState.textContent = "已自动保存在本地";
  } catch (error) { showToast(error.message); }
}

async function copyPackage() {
  const p = state.workspace.publish, d = state.workspace.decisions;
  const lines = [p.titles?.[d.title], p.descriptions?.[d.description], ...(d.tags || []).map((tag) => `#${tag}`), p.comments?.[d.comment]].filter(Boolean);
  if (!lines.length) return showToast("请先选择要使用的发布素材");
  await navigator.clipboard.writeText(lines.join("\n\n"));
  showToast("已选发布方案已复制");
}

async function learnFromProject() {
  if (!hasAIKey()) return openAISettings();
  const payload = currentAIPayload();
  if (textLength(payload.source) < 20 || textLength(payload.draft) < 20) return showToast("需要同时保留原稿和最终定稿，才能开始学习");
  state.ai.running = true;
  renderProjectHeader();
  try {
    const data = await request("/api/ai/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionKey() ? { "X-AI-Api-Key": sessionKey() } : {}),
        ...(searchKey() ? { "X-Search-Api-Key": searchKey() } : {})
      },
      body: JSON.stringify({ provider: selectedProvider(), stage: "learn", model: selectedModel(), payload })
    });
    state.workspace.learningCandidates = (data.result.preferences || []).map((text) => ({ text, selected: true }));
    state.workspace.learningSummary = data.result.summary || "";
    state.workspace.projectMemory = { ...data.result, analyzedAt: new Date().toISOString() };
    await saveWorkspace();
    renderStage();
    showToast(`发现 ${data.result.preferences.length} 条候选偏好，请选择后再放入记忆`);
  } catch (error) { showToast(error.message); }
  finally { state.ai.running = false; renderProjectHeader(); }
}

async function commitLearning() {
  const preferences = (state.workspace.learningCandidates || []).filter((item) => item.selected !== false).map((item) => item.text).filter(Boolean);
  if (!preferences.length) return showToast("请至少选择一条候选偏好");
  state.accountMemory = await request("/api/memory", {
    method: "POST",
    body: JSON.stringify({ preferences, summary: state.workspace.learningSummary || "", projectId: state.project.id, title: state.project.title })
  });
  state.workspace.learningCandidates = [];
  await saveWorkspace();
  renderStage();
  showToast(`已将 ${preferences.length} 条偏好放入账号记忆`);
}

async function removeMemoryPreference(index) {
  const preferences = [...(state.accountMemory.preferences || [])];
  preferences.splice(index, 1);
  state.accountMemory = await request("/api/memory", { method: "PUT", body: JSON.stringify({ preferences }) });
  renderStage();
  showToast("这条账号偏好已删除");
}

async function clearMemory() {
  if (!confirm("确定清空全部账号偏好吗？这不会删除稿件和本篇对话。")) return;
  state.accountMemory = await request("/api/memory", { method: "DELETE" });
  renderStage();
  showToast("账号偏好已清空");
}

async function openSourcePreview(button) {
  const url = button.dataset.url;
  const title = button.dataset.title || "来源预览";
  const excerpt = button.dataset.excerpt || "";
  const fact = state.workspace.factChecks?.find((item) => item.id === button.dataset.id);
  const source = fact?.sources?.[Number(button.dataset.sourceIndex)];
  const cached = source?.evidence;
  els.sourcePreviewTitle.textContent = title;
  els.sourcePreviewUrl.textContent = url;
  els.openOriginalSource.href = url;
  const renderEvidence = (data, cacheLabel = "") => {
    els.sourcePreviewTitle.textContent = data.title || title;
    els.sourcePreviewUrl.textContent = data.url || url;
    els.openOriginalSource.href = data.url || url;
    els.sourcePreviewBody.innerHTML = `${cacheLabel ? `<div class="evidence-cache-label">${escapeHtml(cacheLabel)}</div>` : ""}<article>${escapeHtml(data.before || "")}${data.highlight ? `<mark>${escapeHtml(data.highlight)}</mark>` : ""}${escapeHtml(data.after || "")}</article>${data.matched ? "" : '<p class="preview-warning">没有定位到完全相同的句子；这里展示的是最相关的证据片段，请结合原网页判断。</p>'}`;
  };
  if (cached) {
    renderEvidence(cached, "先显示本篇稿件已缓存的证据，同时在后台重新抓取和定位");
    els.sourcePreviewDialog.showModal();
  } else els.sourcePreviewBody.innerHTML = excerpt
    ? `<div class="preview-loading"><span>AI 提取的相关原话</span><p><mark>${escapeHtml(excerpt)}</mark></p><em>正在读取原网页并定位…</em></div>`
    : '<div class="preview-loading"><em>正在读取原网页并定位相关内容…</em></div>';
  els.sourcePreviewDialog.showModal();
  try {
    const data = await request("/api/source-preview", {
      method: "POST",
      body: JSON.stringify({ url, query: button.dataset.query || "", excerpt })
    });
    renderEvidence(data, "已抓取最相关的正文片段，并保存到本篇稿件的证据库");
    if (source) {
      source.evidence = { ...data, fetchedAt: new Date().toISOString() };
      await saveWorkspace();
    }
  } catch (error) {
    if (cached) renderEvidence(cached, `原网页暂时打不开，继续使用已缓存证据：${error.message}`);
    else els.sourcePreviewBody.innerHTML = `<div class="preview-error"><b>网页预览暂时不可用</b><p>${escapeHtml(error.message)}</p>${excerpt ? `<span>AI 返回的相关原话：</span><blockquote><mark>${escapeHtml(excerpt)}</mark></blockquote>` : ""}</div>`;
  }
}

async function searchFactSources(button) {
  const item = state.workspace.factChecks?.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  const queryInput = $(`[data-source-query][data-id="${CSS.escape(item.id)}"]`, els.stageContent);
  const query = (queryInput?.value || item.sourceQuery || `${item.claim} ${item.summary || ""}`).trim();
  if (!query) return showToast("请先填写检索词");
  if (queryInput) { item.sourceQuery = query; queryInput.value = query; }
  await saveWorkspace();
  const startedAt = Date.now();
  const setStatus = (status, message) => {
    state.sourceSearches[item.id] = { status, message };
    let statusNode = $(`[data-source-search-status="${CSS.escape(item.id)}"]`, els.stageContent);
    if (!statusNode) {
      const row = button.closest(".source-query-row");
      row?.insertAdjacentHTML("afterend", `<div class="source-search-status" data-source-search-status="${escapeHtml(item.id)}"></div>`);
      statusNode = $(`[data-source-search-status="${CSS.escape(item.id)}"]`, els.stageContent);
    }
    if (statusNode) { statusNode.className = `source-search-status ${status}`; statusNode.textContent = message; }
  };
  button.disabled = true;
  button.textContent = "搜索中…";
  setStatus("running", "已开始检索当前关键词· 0 秒");
  clearInterval(sourceSearchTimer);
  sourceSearchTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    setStatus("running", `正在查找并筛选相关来源 · ${elapsed} 秒`);
  }, 1000);
  try {
    const data = await request("/api/source-search", {
      method: "POST",
      body: JSON.stringify({ query, queries: [] })
    });
    item.sources = data.sources || [];
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    state.sourceSearches[item.id] = item.sources.length
      ? { status: "success", message: `搜索完成：找到 ${item.sources.length} 个候选来源 · ${elapsed} 秒` }
      : { status: "empty", message: `搜索完成：没有通过相关性筛选的来源 · ${elapsed} 秒，可换词重试` };
    await saveWorkspace();
    renderStage();
    showToast(item.sources.length ? `找到 ${item.sources.length} 个权威来源，请打开核对` : "没有找到足够可靠的来源，这条断言应谨慎保留");
  } catch (error) {
    setStatus("error", `搜索失败：${error.message}，可修改检索词后重试`);
    showToast(error.message);
    button.disabled = false;
    button.textContent = "⌕ 重试";
  } finally {
    clearInterval(sourceSearchTimer);
  }
}

async function searchAllFactSources(button) {
  const pending = (state.workspace.factChecks || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.sources?.length);
  if (!pending.length) return showToast("当前核验项都已有来源");
  button.disabled = true;
  let foundCount = 0;
  const originalText = button.textContent;
  try {
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const { item, index } = pending[cursor];
      const query = (item.sourceQuery || `${item.claim} ${item.summary || ""}`).trim();
      button.textContent = `正在检索 ${cursor + 1}/${pending.length}：${item.claim?.slice(0, 24)}…`;
      try {
        const data = await request("/api/source-search", {
          method: "POST",
          body: JSON.stringify({ query, queries: Array.isArray(item.searchQueries) ? item.searchQueries : [] })
        });
        const sources = data.sources || [];
        if (sources.length) {
          state.workspace.factChecks[index].sources = sources;
          foundCount += 1;
        }
      } catch { /* 单条失败不影响整体 */ }
      if (cursor < pending.length - 1) await new Promise((resolve) => setTimeout(resolve, 1800));
    }
    await saveWorkspace();
    renderStage();
    showToast(foundCount
      ? `已为 ${foundCount}/${pending.length} 条核验找到较可靠来源；其余可修改检索词后单条重搜`
      : "没有找到足够可靠的官方或机构来源，可修改检索词后再试");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function verifyFactEvidence(button) {
  const item = state.workspace.factChecks?.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (!item.sources?.length) return showToast("请先搜索来源，再让 AI 验证证据");
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "AI 正在阅读来源正文…";
  try {
    const data = await request("/api/ai/run", {
      method: "POST",
      body: JSON.stringify({
        provider: selectedProvider(), stage: "verify", model: selectedModel(),
        payload: { claim: item.claim, sources: item.sources, settings: state.workspace.settings }
      })
    });
    item.verdict = data.result.verdict;
    item.verdictReasoning = data.result.reasoning;
    item.correctStatement = data.result.correctStatement || "";
    await saveWorkspace();
    renderStage();
    const label = { supported: "证据支持该说法", refuted: "证据与该说法矛盾", nei: "证据不足，无法判断" };
    showToast(label[item.verdict] || "验证完成");
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
    button.textContent = originalText;
  }
}

function sessionKey() { return sessionStorage.getItem(AI_KEY_STORAGE) || ""; }
function searchKey() { return sessionStorage.getItem(SEARCH_KEY_STORAGE) || ""; }
function selectedProvider() { return sessionStorage.getItem(AI_PROVIDER_STORAGE) || state.ai.provider || "deepseek"; }
function selectedModel() { return sessionStorage.getItem(AI_MODEL_STORAGE) || state.ai.defaultModel || "deepseek-flash"; }
function hasAIKey() { return state.ai.configured || Boolean(sessionKey()); }

function updateConnectionStatus() {
  const ready = hasAIKey();
  els.connectionDot.classList.toggle("ready", ready);
  els.connectionText.textContent = state.ai.configured
    ? `本机 ${state.ai.providerLabel || "AI"} 已配置，可直接使用`
    : ready ? "当前浏览器会话已保存密钥" : "尚未配置 API Key";
  els.apiKeyInput.placeholder = state.ai.configured ? "已由本机环境变量提供，可留空" : "sk-…";
  els.providerInput.value = selectedProvider();
  els.modelInput.value = selectedModel();
  els.searchKeyInput.value = searchKey();
}

function openAISettings() {
  els.apiKeyInput.value = "";
  updateConnectionStatus();
  els.aiSettingsDialog.showModal();
}

function openStagePrompt(stage = state.activeStage) {
  state.instructionStage = stage;
  const instructions = state.workspace.settings.stageInstructions || {};
  els.instructionDialogTitle.textContent = `${stageNames[stage] || "当前环节"}：这次有什么要求？`;
  els.fixedRequirements.innerHTML = `<b>固定要求</b>${(fixedRequirements[stage] || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}`;
  els.specialInstructions.value = instructions[stage] || (stage === "rewrite" ? state.workspace.settings.specialInstructions || "" : "");
  els.rewritePromptDialog.showModal();
  setTimeout(() => els.specialInstructions.focus(), 0);
}

function renderChat() {
  const target = state.reviewChatTarget;
  const list = target?.kind === "fact" ? state.workspace.factChecks : state.workspace.complianceIssues;
  const reviewItem = target ? list?.find((item) => item.id === target.id) : null;
  const messages = reviewItem ? (reviewItem.reviewConversation || []) : (state.workspace.conversation || []);
  els.chatDialogTitle.textContent = reviewItem ? "和 AI 单独修改这条建议" : "和 AI 一起改这篇稿";
  els.chatStageBadge.textContent = reviewItem ? (target.kind === "fact" ? "事实建议" : "风险建议") : `当前：${stageNames[state.activeStage]}`;
  els.chatCardContext.textContent = reviewItem ? `对应原文：${target.kind === "fact" ? reviewItem.claim : reviewItem.original}` : "这篇稿的对话会一直保留，并参与后面的生成。";
  const allMessages = state.workspace.conversation || [];
  els.chatMemoryStatus.textContent = `已记住本篇 ${allMessages.filter((item) => item.role === "user").length} 次沟通 · 账号偏好 ${state.accountMemory.preferences?.length || 0} 条`;
  els.chatMessages.innerHTML = messages.length ? messages.map((item) => `
    <article class="chat-message ${item.role}"><div><span>${item.role === "user" ? "我" : "AI"}</span><em>${reviewItem ? "本条建议" : escapeHtml(stageNames[item.stage] || item.stage || "整篇")}</em></div><p>${escapeHtml(item.text).replace(/\n/g, "<br>")}</p></article>`).join("") : reviewItem ? `
    <div class="chat-empty"><b>只修改这条建议</b><p>例如：“说得更严谨一点”“保留情绪，但别下绝对结论”“换成更顺口的大白话”。AI 的新版本会直接回填到建议框，你仍可手改。</p></div>` : `
    <div class="chat-empty"><b>这是这篇稿件的专属对话</b><p>你可以说“这一段太书面”“以后少用排比”“这次结尾克制一点”。对话会随稿件保存，生成时也会参考。</p></div>`;
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function openChat() {
  state.reviewChatTarget = null;
  renderChat();
  els.chatDialog.showModal();
  setTimeout(() => els.chatInput.focus(), 0);
}

function openReviewChat(kind, id) {
  state.reviewChatTarget = { kind, id };
  renderChat();
  els.chatDialog.showModal();
  setTimeout(() => els.chatInput.focus(), 0);
}

async function sendChat(message) {
  const text = String(message || "").trim();
  if (!text || state.chatRunning) return;
  if (!hasAIKey()) return openAISettings();
  const target = state.reviewChatTarget;
  const list = target?.kind === "fact" ? state.workspace.factChecks : state.workspace.complianceIssues;
  const reviewItem = target ? list?.find((item) => item.id === target.id) : null;
  const userMessage = { role: "user", text, stage: state.activeStage, at: new Date().toISOString() };
  state.workspace.conversation ||= [];
  if (reviewItem) {
    reviewItem.reviewConversation ||= [];
    reviewItem.reviewConversation.push(userMessage);
    state.workspace.conversation.push({ ...userMessage, text: `[${target.kind === "fact" ? "事实" : "风险"}建议] ${text}` });
  } else state.workspace.conversation.push(userMessage);
  await saveWorkspace();
  els.chatInput.value = "";
  state.chatRunning = true;
  els.sendChatButton.disabled = true;
  els.sendChatButton.textContent = "思考中…";
  renderChat();
  try {
    const payload = reviewItem ? {
      ...currentAIPayload(), message: text, kind: target.kind,
      claim: target.kind === "fact" ? reviewItem.claim : reviewItem.original,
      reason: reviewItem.summary || reviewItem.reason || "",
      sources: reviewItem.sources || [], suggestion: reviewItem.suggestion || "",
      reviewConversation: reviewItem.reviewConversation.slice(-12)
    } : { ...currentAIPayload(), message: text, currentStage: state.activeStage, conversation: state.workspace.conversation.slice(-20) };
    const data = await request("/api/ai/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionKey() ? { "X-AI-Api-Key": sessionKey() } : {}),
        ...(searchKey() ? { "X-Search-Api-Key": searchKey() } : {})
      },
      body: JSON.stringify({ provider: selectedProvider(), stage: reviewItem ? "suggestion" : "chat", model: selectedModel(), payload })
    });
    if (reviewItem) {
      reviewItem.suggestion = String(data.result.suggestion || reviewItem.suggestion).trim();
      reviewItem.reviewConversation.push({ role: "assistant", text: data.result.reply, stage: state.activeStage, at: new Date().toISOString() });
      state.workspace.conversation.push({ role: "assistant", text: `[${target.kind === "fact" ? "事实" : "风险"}建议] ${data.result.reply}`, stage: "review", at: new Date().toISOString() });
    } else state.workspace.conversation.push({ role: "assistant", text: data.result.reply, stage: state.activeStage, at: new Date().toISOString() });
    await saveWorkspace();
    renderChat();
  } catch (error) { showToast(error.message); }
  finally {
    state.chatRunning = false;
    els.sendChatButton.disabled = false;
    els.sendChatButton.textContent = "发送";
  }
}

function scheduleMetadata(delay = 1600) {
  clearTimeout(metadataTimer);
  const editor = $("#sourceEditor");
  const unnamed = !state.project || /^未命名口播稿/.test(state.project.title);
  if (!editor || !unnamed || textLength(editor.value) < 80 || !hasAIKey()) return;
  metadataTimer = setTimeout(() => generateProjectMetadata(editor.value), delay);
}

async function generateProjectMetadata(sourceText) {
  if (state.metadataRunning || !state.project || !/^未命名口播稿/.test(state.project.title)) return;
  const projectId = state.project.id;
  const originalContent = withSourceBody(state.project.files.original.content, sourceText);
  const workspace = structuredClone(state.workspace);
  state.metadataRunning = true;
  els.saveState.textContent = "AI 正在识别标题与领域…";
  try {
    await request(`/api/projects/${encodeURIComponent(projectId)}/files/original`, {
      method: "PUT", body: JSON.stringify({ content: originalContent })
    });
    const data = await request("/api/ai/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionKey() ? { "X-AI-Api-Key": sessionKey() } : {}),
        ...(searchKey() ? { "X-Search-Api-Key": searchKey() } : {})
      },
      body: JSON.stringify({
        provider: selectedProvider(), stage: "metadata", model: selectedModel(),
        payload: { source: sourceText, settings: workspace.settings }
      })
    });
    const title = String(data.result.title || "").replace(/[《》“”"'！!。]/g, "").trim().slice(0, 28) || "未命名口播稿";
    workspace.metadata = {
      domain: data.result.domain || "其他",
      tags: (data.result.tags || []).map((tag) => String(tag).replace(/^#/, "").trim()).filter(Boolean).slice(0, 3),
      generated: true,
      generatedAt: new Date().toISOString()
    };
    const titledOriginal = withProjectTitle(originalContent, title);
    await Promise.all([
      request(`/api/projects/${encodeURIComponent(projectId)}/files/original`, { method: "PUT", body: JSON.stringify({ content: titledOriginal }) }),
      request(`/api/projects/${encodeURIComponent(projectId)}/files/workspace`, { method: "PUT", body: JSON.stringify({ content: `${JSON.stringify(workspace, null, 2)}\n` }) })
    ]);
    state.projects = (await request("/api/projects")).projects;
    if (state.project?.id === projectId) {
      state.project.title = title;
      state.project.files.original.content = titledOriginal;
      state.workspace = workspace;
      state.sourceDirty = false;
      renderProjects();
      renderProjectHeader();
      els.saveState.textContent = "已自动保存在本地";
      showToast(`已归类：${workspace.metadata.domain} · ${workspace.metadata.tags.join(" / ")}`);
    }
  } catch (error) {
    if (state.project?.id === projectId) {
      els.saveState.textContent = "标题识别失败，稿件仍可继续编辑";
      showToast(`自动归类失败：${error.message}`);
    }
  } finally { state.metadataRunning = false; }
}

async function createQuickProject() {
  if ((state.sourceDirty || state.correctedDirty || state.rewriteDirty) && !confirm("当前内容还没有保存，确定新建稿件吗？")) return;
  const button = $("#newProjectButton");
  button.disabled = true;
  try {
    const now = new Date();
    const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0"), String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
    const data = await request("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: `draft-${stamp}`, title: "未命名口播稿" })
    });
    state.projects = (await request("/api/projects")).projects;
    state.project = data.project;
    state.workspace = loadWorkspace(data.project);
    state.domainFilter = "全部";
    state.activeStage = "source";
    state.sourceDirty = state.correctedDirty = state.rewriteDirty = false;
    renderProject();
    els.sidebar.classList.remove("open");
    $("#sourceEditor")?.focus();
    showToast("新稿已创建，直接粘贴原稿即可");
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; }
}

function currentAIPayload() {
  const source = $("#sourceEditor")?.value || sourceBody(state.project.files.original.content);
  const corrected = formatCorrectedDraft($("#correctedEditor")?.value || (isMeaningful(state.project.files.corrected.content) ? stripHeading(state.project.files.corrected.content) : source));
  const draft = $("#reviewEditor")?.value || $("#rewriteEditor")?.value || (isMeaningful(state.project.files.voiceover.content)
    ? stripHeading(state.project.files.voiceover.content)
    : isMeaningful(state.project.files.styled.content) ? stripHeading(state.project.files.styled.content) : corrected);
  return {
    source, corrected, draft, settings: state.workspace.settings,
    conversation: state.workspace.conversation || [], projectMemory: state.workspace.projectMemory || {}
  };
}

function withIds(items, prefix) {
  return items.map((item, index) => ({ ...item, id: `${prefix}-${Date.now()}-${index}`, status: "pending" }));
}

async function applyAIResult(stage, result) {
  if (stage === "source") {
    if (state.sourceDirty) {
      await saveFile("original", withSourceBody(state.project.files.original.content, $("#sourceEditor").value));
      state.sourceDirty = false;
    }
    const corrected = formatCorrectedDraft(result.corrected);
    await saveFile("corrected", `# 整理后的原始稿\n\n${corrected}\n`);
  } else if (stage === "rewrite") {
    await saveFile("voiceover", `# 最终口播稿\n\n${result.rewrite.trim()}\n`);
    state.workspace.bodyDraft = result.rewrite.trim();
    await saveWorkspace();
    state.rewriteDirty = false;
  } else if (stage === "openings") {
    state.workspace.openingBody = String(result.body || "").trim();
    state.workspace.assembledDraft = "";
    state.workspace.openingOptions = withIds(result.openings, "opening").map(({ status, ...item }) => ({ ...item, selected: false }));
    state.workspace.endingOptions = withIds(result.endings, "ending").map(({ status, ...item }) => ({ ...item, selected: false }));
    await saveWorkspace();
  } else if (stage === "facts") {
    state.workspace.factChecks = withIds(result.factChecks, "fact");
    await saveWorkspace();
  } else if (stage === "compliance") {
    state.workspace.complianceIssues = withIds(result.complianceIssues, "risk");
    await saveWorkspace();
  } else if (stage === "publish") {
    state.workspace.publish = { ...result, pronunciations: Array.isArray(result.pronunciations) ? result.pronunciations : [] };
    state.workspace.decisions = {};
    await saveWorkspace();
  }
}

async function runAIStage({ stageOverride, bypassPrompt = false } = {}) {
  if (!hasAIKey()) return openAISettings();
  if (state.ai.running) return showToast("AI 正在处理，请等待当前任务完成");
  const effectiveStage = stageOverride || state.activeStage;
  if (!bypassPrompt) return openStagePrompt(effectiveStage);
  const payload = currentAIPayload();
  const requiredText = effectiveStage === "source" ? payload.source : effectiveStage === "rewrite" ? payload.corrected : payload.draft;
  if (!requiredText || textLength(requiredText) < 20) return showToast("请先准备好当前环节需要的稿件");
  if (effectiveStage === "review" && state.rewriteDirty) {
    await saveFile("voiceover", `# 最终口播稿\n\n${payload.draft.trim()}\n`);
    state.rewriteDirty = false;
  }
  state.ai.running = true;
  clearInterval(aiProgressTimer);
  const startedAt = Date.now();
  setAIProgress({ stage: effectiveStage, status: "running", percent: 8, elapsed: 0, label: "正在准备稿件", detail: "已检查当前文本与本环节要求" });
  aiProgressTimer = setInterval(() => {
    if (!state.ai.progress || state.ai.progress.status !== "running") return;
    state.ai.progress.elapsed = Math.floor((Date.now() - startedAt) / 1000);
    updateAIProgressUI();
  }, 1000);
  renderProjectHeader();
  try {
    const stages = effectiveStage === "review" ? ["facts", "compliance"] : [effectiveStage];
    let totalTokens = 0;
    let rewriteInfo = null;
    for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
      const stage = stages[stageIndex];
      const progressLabels = {
        source: ["正在调用 AI 整理原稿", "只纠错、断句和重组大段落"],
        rewrite: ["正在调用 AI 重构稿件", "模型可能会再次校准字数，用时会更长"],
        openings: ["正在生成开头和结尾", "同时剥离旧首尾，保留中间正文"],
        facts: ["正在核验事实并检索来源", "会识别事实点，并尝试读取政府、高校和博物馆来源"],
        compliance: ["正在检查违禁词与风险表达", "结合全文语境给出替换建议"],
        publish: ["正在生成发布素材", "生成标题、描述、标签、互动话术和易读错词"]
      };
      const [label, detail] = progressLabels[stage];
      const requestPercent = effectiveStage === "review" ? (stageIndex === 0 ? 22 : 62) : 32;
      setAIProgress({ label, detail, percent: requestPercent });
      const stagePayload = effectiveStage === "review" ? {
        ...payload,
        settings: {
          ...payload.settings,
          stageInstructions: { ...(payload.settings.stageInstructions || {}), [stage]: payload.settings.stageInstructions?.review || "" }
        }
      } : payload;
      const data = await request("/api/ai/run", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        ...(sessionKey() ? { "X-AI-Api-Key": sessionKey() } : {}),
        ...(searchKey() ? { "X-Search-Api-Key": searchKey() } : {})
      },
        body: JSON.stringify({ provider: selectedProvider(), stage, model: selectedModel(), payload: stagePayload })
      });
      setAIProgress({
        label: stage === "facts" ? "事实核验已返回，正在保存" : stage === "compliance" ? "风险检查已返回，正在保存" : "AI 已返回，正在保存结果",
        detail: "正在写入当前稿件工作区",
        percent: effectiveStage === "review" ? (stageIndex === 0 ? 52 : 88) : 82
      });
      await applyAIResult(stage, data.result);
      totalTokens += Number(data.usage?.total_tokens || 0);
      if (stage === "rewrite") rewriteInfo = data;
    }
    setAIProgress({ status: "complete", percent: 100, label: "AI 处理完成", detail: "结果已保存，可以继续修改或重新生成", elapsed: Math.floor((Date.now() - startedAt) / 1000) });
    renderProject();
    if (rewriteInfo) {
      const target = Number(state.workspace.settings.targetLength) || 1800;
      const finalLength = rewriteInfo.finalLength || textLength(rewriteInfo.result.rewrite);
      showToast(`改写完成：${finalLength} 字，目标 ${target} 字${rewriteInfo.adjustedToTarget ? " · 已自动校准" : ""}`);
    } else showToast(`AI 已完成${totalTokens ? ` · ${totalTokens} tokens` : ""}`);
  } catch (error) {
    setAIProgress({ status: "error", label: "AI 处理未完成", detail: error.message, elapsed: Math.floor((Date.now() - startedAt) / 1000) });
    showToast(error.message);
    if (/API Key|Incorrect API key|401/i.test(error.message)) openAISettings();
  } finally {
    clearInterval(aiProgressTimer);
    state.ai.running = false;
    renderProjectHeader();
    updateAIProgressUI();
  }
}

els.workflowNav.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-stage]");
  if (!button) return;
  if ((state.sourceDirty || state.correctedDirty || state.rewriteDirty) && !confirm("当前修改还没有保存，确定切换环节吗？")) return;
  state.activeStage = button.dataset.stage;
  state.workspace.currentStage = state.activeStage;
  await saveWorkspace();
  renderStage();
});

function alignReviewPair(key, origin) {
  const card = $(`[data-review-card="${CSS.escape(key)}"]`, els.stageContent);
  const mark = $(`[data-review-highlight="${CSS.escape(key)}"]`, els.stageContent);
  if (!card || !mark) return;
  if (origin === "mark") {
    const scroller = card.closest(".combined-review");
    if (scroller) scroller.scrollTo({ top: scroller.scrollTop + card.getBoundingClientRect().top - mark.getBoundingClientRect().top, behavior: "smooth" });
    card.classList.add("focused");
    setTimeout(() => card.classList.remove("focused"), 1800);
  } else {
    const scroller = mark.closest(".annotated-copy");
    if (scroller) scroller.scrollTo({ top: scroller.scrollTop + mark.getBoundingClientRect().top - card.getBoundingClientRect().top, behavior: "smooth" });
    mark.classList.add("focused");
    setTimeout(() => mark.classList.remove("focused"), 1800);
  }
}

els.stageContent.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) return handleStageAction(actionButton.dataset.action);
  const memoryRemove = event.target.closest("[data-memory-remove]");
  if (memoryRemove) return removeMemoryPreference(Number(memoryRemove.dataset.memoryRemove));
  const sourceSearch = event.target.closest("[data-source-search]");
  if (sourceSearch) return searchFactSources(sourceSearch);
  const aiVerify = event.target.closest("[data-ai-verify]");
  if (aiVerify) return verifyFactEvidence(aiVerify);
  const verdictClear = event.target.closest("[data-verdict-clear]");
  if (verdictClear) {
    const target = state.workspace.factChecks?.find((entry) => entry.id === verdictClear.dataset.id);
    if (target) {
      delete target.verdict; delete target.verdictReasoning; delete target.correctStatement;
      await saveWorkspace(); renderStage();
    }
    return;
  }
  const sourcePreview = event.target.closest("[data-source-preview]");
  if (sourcePreview) return openSourcePreview(sourcePreview);
  const reviewChat = event.target.closest("[data-review-chat]");
  if (reviewChat) return openReviewChat(reviewChat.dataset.reviewChat, reviewChat.dataset.id);
  const highlight = event.target.closest("[data-review-highlight]");
  if (highlight) {
    alignReviewPair(highlight.dataset.reviewHighlight, "mark");
    return;
  }
  const reviewCard = event.target.closest("[data-review-card]");
  if (reviewCard && !event.target.closest("button, textarea, input, a")) {
    alignReviewPair(reviewCard.dataset.reviewCard, "card");
    return;
  }
  const setting = event.target.closest("[data-setting]");
  if (setting) { state.workspace.settings[setting.dataset.setting] = setting.dataset.value; await saveWorkspace(); renderStage(); return; }
  const option = event.target.closest("[data-option-type]");
  if (option) {
    const list = option.dataset.optionType === "opening" ? state.workspace.openingOptions : state.workspace.endingOptions;
    list.forEach((item) => { item.selected = item.id === option.dataset.optionId; });
    state.workspace.assembledDraft = "";
    await saveWorkspace(); renderStage(); return;
  }
  const decision = event.target.closest("[data-review]");
  if (decision) return decide(decision.dataset.review, decision.dataset.id, decision.dataset.status);
  const publishOption = event.target.closest("[data-publish-type]");
  if (publishOption) {
    const type = publishOption.dataset.publishType;
    const index = Number(publishOption.dataset.index);
    state.workspace.decisions[type] = index;
    await saveWorkspace();
    if (type === "title") {
      const title = state.workspace.publish.titles?.[index];
      if (title) {
        await updateProjectMetadata(state.project.id, {
          title,
          domain: state.workspace.metadata.domain || state.projects.find((item) => item.id === state.project.id)?.domain || "其他",
          tags: state.workspace.metadata.tags || []
        });
        showToast("已选标题，并同步到左侧稿件列表");
        return;
      }
    }
    renderStage(); return;
  }
  const tag = event.target.closest("[data-tag]");
  if (tag) {
    const tags = new Set(state.workspace.decisions.tags || []);
    tags.has(tag.dataset.tag) ? tags.delete(tag.dataset.tag) : tags.add(tag.dataset.tag);
    state.workspace.decisions.tags = [...tags]; await saveWorkspace(); renderStage();
  }
});

els.stageContent.addEventListener("pointerover", (event) => {
  const linked = event.target.closest("[data-review-card], [data-review-highlight]");
  const key = linked?.dataset.reviewCard || linked?.dataset.reviewHighlight;
  if (!key) return;
  $$(`[data-review-card="${CSS.escape(key)}"], [data-review-highlight="${CSS.escape(key)}"]`, els.stageContent).forEach((item) => item.classList.add("linked-hover"));
});

els.stageContent.addEventListener("pointerout", (event) => {
  const linked = event.target.closest("[data-review-card], [data-review-highlight]");
  const key = linked?.dataset.reviewCard || linked?.dataset.reviewHighlight;
  if (!key || linked.contains(event.relatedTarget)) return;
  $$(`[data-review-card="${CSS.escape(key)}"], [data-review-highlight="${CSS.escape(key)}"]`, els.stageContent).forEach((item) => item.classList.remove("linked-hover"));
});

els.stageContent.addEventListener("change", async (event) => {
  if (event.target.dataset.learningCandidate !== undefined) {
    const candidate = state.workspace.learningCandidates?.[Number(event.target.dataset.learningCandidate)];
    if (candidate) { candidate.selected = event.target.checked; await saveWorkspace(); }
  } else if (event.target.id === "targetLength") {
    state.workspace.settings.targetLength = Math.max(300, Math.min(10000, Number(event.target.value) || 1800));
    await saveWorkspace(); renderStage();
  } else if (event.target.dataset.publishEdit === "title" && state.workspace.decisions.title === Number(event.target.dataset.index)) {
    clearTimeout(optionSaveTimer);
    await saveWorkspace();
    await updateProjectMetadata(state.project.id, {
      title: event.target.value.trim(),
      domain: state.workspace.metadata.domain || "其他",
      tags: state.workspace.metadata.tags || []
    });
    showToast("已同步更新左侧稿件标题");
  }
});

els.generateButton.addEventListener("click", () => {
  if (state.activeStage === "openings" && state.workspace.openingOptions?.length && state.workspace.endingOptions?.length) {
    return handleStageAction("assemble");
  }
  return runAIStage();
});

$("#processButton").addEventListener("click", () => openProcess());
$("#openChatButton").addEventListener("click", openChat);
$("#closeChatButton").addEventListener("click", () => { els.chatDialog.close(); state.reviewChatTarget = null; renderStage(); });
$("#closeSourcePreviewButton").addEventListener("click", () => els.sourcePreviewDialog.close());
els.chatForm.addEventListener("submit", async (event) => { event.preventDefault(); await sendChat(els.chatInput.value); });
els.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.chatForm.requestSubmit();
  }
});
$("#closeProcessButton").addEventListener("click", () => els.processDialog.close());
$("#closeEditorButton").addEventListener("click", () => els.editorDialog.close());
$("#cancelResultEdit").addEventListener("click", () => els.editorDialog.close());
$("#saveResultButton").addEventListener("click", async () => {
  await saveFile("voiceover", els.resultEditor.value); els.editorDialog.close(); renderStage(); showToast("成稿已保存");
});
$("#newProjectButton").addEventListener("click", createQuickProject);
$("#mobileMenu").addEventListener("click", () => els.sidebar.classList.toggle("open"));
$("#aiSettingsButton").addEventListener("click", openAISettings);
$("#memoryButton").addEventListener("click", async () => {
  state.activeStage = "publish";
  state.workspace.currentStage = "publish";
  await saveWorkspace();
  renderStage();
  setTimeout(() => $(".learning-group")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
});

els.projectManageForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const id = els.manageProjectId.value;
  const tags = els.manageTags.value.split(/[，,]/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 3);
  try {
    await updateProjectMetadata(id, { title: els.manageTitle.value.trim(), domain: els.manageDomain.value, tags });
    els.projectManageDialog.close();
    showToast("稿件分类与标题已更新");
  } catch (error) { showToast(error.message); }
});

$("#deleteProjectButton").addEventListener("click", async () => {
  const id = els.manageProjectId.value;
  const project = state.projects.find((item) => item.id === id);
  if (!project || !confirm(`确定删除“${project.title}”吗？稿件会移到本地回收目录。`)) return;
  try {
    await request(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    els.projectManageDialog.close();
    state.projects = (await request("/api/projects")).projects;
    if (state.project?.id === id) {
      state.project = null;
      state.workspace = null;
      state.sourceDirty = state.correctedDirty = state.rewriteDirty = false;
      if (state.projects.length) await selectProject(state.projects[0].id);
      else await createQuickProject();
    } else renderProjects();
    showToast("稿件已移到本地回收目录");
  } catch (error) { showToast(error.message); }
});

els.rewritePromptForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  state.workspace.settings.stageInstructions ||= {};
  state.workspace.settings.stageInstructions[state.instructionStage] = els.specialInstructions.value.trim();
  if (state.instructionStage === "rewrite") state.workspace.settings.specialInstructions = els.specialInstructions.value.trim();
  await saveWorkspace();
  els.rewritePromptDialog.close();
  await runAIStage({ stageOverride: state.instructionStage, bypassPrompt: true });
});

$("#saveInstructionButton").addEventListener("click", async () => {
  state.workspace.settings.stageInstructions ||= {};
  state.workspace.settings.stageInstructions[state.instructionStage] = els.specialInstructions.value.trim();
  if (state.instructionStage === "rewrite") state.workspace.settings.specialInstructions = els.specialInstructions.value.trim();
  await saveWorkspace();
  els.rewritePromptDialog.close();
  renderStage();
  showToast("本环节要求已记住");
});

$("#clearSpecialButton").addEventListener("click", () => {
  els.specialInstructions.value = "";
  els.specialInstructions.focus();
});
$("#clearAIKeyButton").addEventListener("click", () => {
  sessionStorage.removeItem(AI_KEY_STORAGE);
  sessionStorage.removeItem(SEARCH_KEY_STORAGE);
  els.apiKeyInput.value = "";
  els.searchKeyInput.value = "";
  updateConnectionStatus();
  showToast("浏览器会话中的密钥已清除");
});

els.aiSettingsForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const key = els.apiKeyInput.value.trim();
  const sKey = els.searchKeyInput.value.trim();
  const provider = els.providerInput.value;
  const model = els.modelInput.value.trim() || state.ai.defaultModel;
  if (key) sessionStorage.setItem(AI_KEY_STORAGE, key);
  if (sKey) sessionStorage.setItem(SEARCH_KEY_STORAGE, sKey);
  else sessionStorage.removeItem(SEARCH_KEY_STORAGE);
  sessionStorage.setItem(AI_PROVIDER_STORAGE, provider);
  sessionStorage.setItem(AI_MODEL_STORAGE, model);
  if (!hasAIKey()) return showToast("请填写 AI API Key");
  els.aiSettingsDialog.close();
  showToast("AI 设置已保存");
});

els.providerInput.addEventListener("change", () => {
  els.modelInput.value = els.providerInput.value === "deepseek" ? "deepseek-flash" : "gpt-5.4-mini";
});

window.addEventListener("beforeunload", (event) => { if (state.sourceDirty || state.correctedDirty || state.rewriteDirty) event.preventDefault(); });

async function init() {
  try {
    const [aiStatus, memory] = await Promise.all([request("/api/ai/status"), request("/api/memory")]);
    state.ai = { ...state.ai, ...aiStatus };
    state.accountMemory = memory;
    state.projects = (await request("/api/projects")).projects;
    renderProjects();
    if (state.projects.length) await selectProject(state.projects[0].id);
    else await createQuickProject();
  } catch (error) { showToast(`载入失败：${error.message}`); }
}

init();
