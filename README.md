# 言己 · 口播稿重构助手

一个把参考内容转化为个人表达的口播稿重构工具。言己先理解原稿的信息、结构和表达方法，再结合账号风格重写叙事、语言与节奏，让每一次改写都有可追踪的过程和可直接录制的成稿。

## 可视化工作台

项目包含一个零外部依赖的本地 Web 工作台，按照口播稿创作的典型流程组织成六个环节：原稿整理、AI 改写、开头结尾、事实核验、违禁词检查和发布素材。稿件字数、选择结果和审查决定都会直接保存回现有 `projects/` 目录。

新建稿件后只需粘贴原文。系统会在输入停止后自动用 AI 生成侧栏短标题，识别历史、地理、时事等主领域和细分标签，并支持在左侧按领域快速筛选。

```bash
npm start
```

然后访问：

```text
http://127.0.0.1:4173
```

开发时可以使用 `npm run dev`，文件变化后服务会自动重启。六个环节支持 DeepSeek 和 OpenAI；默认使用 DeepSeek，可在网页设置中切换。OpenAI 模式的事实核验可以额外使用 Web Search，DeepSeek 模式会明确标注无法实时联网，不会伪造已浏览的来源。

### 连接 AI

最方便的方式是在网页左下角打开“AI 设置”，选择服务并填写 API Key。通过网页填写的密钥只保存在当前浏览器会话的 `sessionStorage`，不会写入项目文件。关闭该浏览器会话后需要重新填写。

也可以在启动服务前通过本机环境变量提供：

```bash
DEEPSEEK_API_KEY="你的密钥" DEEPSEEK_MODEL="deepseek-flash" npm start
```

项目也会自动读取被 Git 忽略的 `.env.local`。当前 DeepSeek 默认模型为 `deepseek-flash`，也可以在网页设置中修改。每次只运行当前选中的环节，便于检查结果并控制调用成本。

### 来源搜索配置（可选但推荐）

事实核验环节需要联网检索证据来源。有两种方式：

1. **稳定搜索 API（推荐）**：到 [serper.dev](https://serper.dev) 免费注册（Google/GitHub 账号即可，无需信用卡），获得 2500 次免费查询额度。把 Key 填到网页设置的"来源搜索 Key"，或设置环境变量 `SERPER_API_KEY`。
2. **免费网页搜索（默认 fallback）**：不配置 Key 时，系统会通过必应/DuckDuckGo/搜狗的公开网页检索，无需注册但可能被搜索引擎限流，结果不够稳定。

## 项目特点

- **项目制管理**：每条稿件对应 `projects/<project-slug>/` 下的独立工作区，输入、过程、最终稿和日志互不混杂。
- **半自动工作流**：默认在关键节点暂停确认，避免 AI 静默生成不符合账号风格或事实风险较高的内容。
- **表达学习优先**：先提取原稿中的金句、情绪句、悬念句、类比和节奏，再进入改写，做到学习表达手法而不是照搬原文。
- **账号记忆沉淀**：通过 `memory/content_memory.md` 记录可复用经验，帮助后续稿件逐步贴近账号风格。
- **合规与事实审查**：内置敏感词、平台规则、替代表达和事实资料目录，降低口播稿与字幕的发布风险。
- **最终交付清爽**：`final/` 目录只保留可直接使用的口播稿和字幕安全版，过程稿、审查报告、发布文案留在 `process/`。

## 目录结构

```text
.
├── skills/
│   ├── media-workflow/          # 顶层项目编排工作流
│   └── content-production/      # 口播稿生产、改写、审查、包装规则
├── scripts/
│   └── new_project.sh           # 创建新稿件项目的脚本
├── projects/
│   └── <project-slug>/          # 单条稿件项目目录
├── memory/
│   └── content_memory.md        # 全局内容生产经验记忆
├── materials/
│   ├── input/                   # 临时/全局原始稿输入
│   ├── output/                  # 临时/全局阶段输出
│   ├── profile/                 # 账号定位、写作风格、禁用风格
│   ├── ideas/                   # 观点、案例素材、金句库
│   ├── facts/                   # 事实来源、数据备注、存疑事实
│   ├── compliance/              # 敏感词、平台规则、替代表达
│   └── memory/                  # 旧版/兼容记忆文件
└── 自媒体口播稿工作流_PRD.md      # 项目制工作流说明
```

## 快速开始

### 1. 创建新项目

```bash
scripts/new_project.sh 2026-05-16-yellow-river
```

项目名建议使用日期加主题，例如：

```text
2026-05-16-yellow-river
2026-05-20-city-memory
2026-06-01-history-story
```

脚本会生成如下目录：

```text
projects/<project-slug>/
├── input/
│   └── original_script.md
├── context/
│   └── project_brief.md
├── process/
│   └── source_extraction.md
├── final/
│   ├── voiceover.md
│   └── subtitle.md
└── logs/
    └── workflow_log.md
```

### 2. 填写原始稿

把已经提取好的原视频口播稿粘贴到：

```text
projects/<project-slug>/input/original_script.md
```

建议同时补充来源平台、原视频标题、作者、发布时间、链接、本项目要求、希望保留与希望避免的表达。

### 3. 运行工作流

在支持本仓库 skills 的 AI 编码/写作环境中，对助手说：

```text
请运行 media-workflow 处理 projects/<project-slug>
```

默认会进入半自动模式，在关键节点向你确认方向。

## 工作流阶段

1. **项目识别**：确认要处理的 `projects/<project-slug>/`。
2. **读取输入**：加载原始稿、项目 brief、账号资料、合规资料和全局记忆。
3. **原稿表达提取**：提取金句、情绪句、悬念句、类比、节奏和事实点。
4. **用户确认学习方向**：确认哪些表达手法可以学习，哪些必须规避。
5. **轻度校正**：修正明显语病和表达问题，不改变原意。
6. **开头重写**：生成悬念型、反差型、事实冲击型等开头方向。
7. **降重改写**：避免照搬原结构和特色表述。
8. **内容深化**：增强画面感、知识密度、情绪层次或克制表达。
9. **风格融合**：结合账号资料和历史记忆统一口吻。
10. **事实与合规审查**：检查事实存疑、敏感表达、逻辑跳跃和平台风险。
11. **最终口播稿**：生成可直接录制的 `voiceover.md`。
12. **字幕安全版**：生成更适合发布平台字幕的 `subtitle.md`。
13. **发布包装**：在过程目录生成标题、封面文案、简介、标签和推荐组合。
14. **记忆建议**：生成是否写入全局记忆的建议，需用户确认后再追加。

## 默认确认节点

工作流默认不是“一键静默跑完”，会在这些节点暂停：

1. **原视频学习**：确认要学习哪些金句、情绪句、悬念、类比和节奏。
2. **开头方向**：选择悬念型、反差型、强事实冲击型或年代共情型等方向。
3. **风格方向**：确认更有画面、更有知识密度、更有情绪，还是更克制。
4. **风险处理**：对事实存疑、敏感词、过强表达选择删除、弱化或补证据。
5. **Memory 更新**：确认本次经验是否写入 `memory/content_memory.md`。

如需全自动处理，需要在指令中明确说明。

## 输出文件

最终交付只放在：

```text
projects/<project-slug>/final/voiceover.md
projects/<project-slug>/final/subtitle.md
```

其他过程产物通常位于：

```text
projects/<project-slug>/process/source_extraction.md
projects/<project-slug>/process/review_report.md
projects/<project-slug>/process/publish_package.md
projects/<project-slug>/process/memory_update.md
projects/<project-slug>/logs/workflow_log.md
```

## 内容原则

- 要有悬念，但不能造假。
- 要学习原稿的表达技巧，但不能照搬原文。
- 要有画面感、类比、反差和尺度感。
- 要理性、客观，不煽动、不制造对立。
- 要保留能打动人的表达，而不是把稿子改成说明文。
- 高风险事实必须弱化、删除、标注待补证据，或用可信来源支撑。

## 示例项目

仓库中包含一个样例项目：

```text
projects/2026-05-16-yellow-river/
```

可以重点查看：

```text
projects/2026-05-16-yellow-river/process/source_extraction.md
projects/2026-05-16-yellow-river/process/review_report.md
projects/2026-05-16-yellow-river/process/publish_package.md
projects/2026-05-16-yellow-river/final/voiceover.md
projects/2026-05-16-yellow-river/final/subtitle.md
```

## 自定义资料

你可以根据自己的账号继续维护这些文件：

- `materials/profile/account_profile.md`：账号定位、目标观众、内容边界。
- `materials/profile/writing_style.md`：常用语气、节奏、表达偏好。
- `materials/profile/prohibited_style.md`：不希望出现的表达方式。
- `materials/ideas/my观点.md`：可复用观点。
- `materials/ideas/案例素材.md`：案例和素材库。
- `materials/ideas/金句库.md`：自有金句库。
- `materials/facts/fact_sources.md`：可引用事实来源。
- `materials/compliance/sensitive_words.md`：敏感词和风险表达。
- `materials/compliance/replacement_rules.md`：安全替代表达规则。

## 适用场景

- 短视频口播稿二创与改写
- 历史、人文、地理、社会观察类文案生产
- 视频字幕安全化处理
- 发布标题、封面文案、简介和标签生成
- 账号长期风格记忆沉淀
- 有过程留痕要求的内容生产

## 开源前注意

如果要将仓库发布到 GitHub，建议先检查并清理：

- 原视频链接、作者、平台账号等可能不适合公开的信息。
- `materials/profile/` 中的私人账号定位或商业策略。
- `memory/` 中不希望公开的长期创作经验。
- `projects/` 中包含版权风险、未授权稿件或敏感来源的样例。
- 任何个人联系方式、客户信息、内部数据或未公开素材。

## License

如需开源，建议根据你的使用目标补充许可证，例如 MIT、Apache-2.0 或仅保留个人使用声明。
