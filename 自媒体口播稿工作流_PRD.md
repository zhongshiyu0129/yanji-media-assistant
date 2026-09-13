# 自媒体口播稿项目制 Workflow PRD

## 1. 当前架构

本系统采用：

- 全局 memory：`memory/content_memory.md`
- 全局账号资料：`materials/profile/`
- 全局合规资料：`materials/compliance/`
- 每次稿件一个独立项目：`projects/<project-slug>/`
- 两个 skill：`skills/media-workflow/` 和 `skills/content-production/`
- 创建项目脚本：`scripts/new_project.sh`

## 2. 项目目录

每次新稿件都创建一个项目：

```bash
scripts/new_project.sh 2026-05-16-yellow-river
```

生成结构：

```text
projects/<slug>/
├── input/
│   └── original_script.md
├── context/
│   └── project_brief.md
├── process/
│   ├── source_extraction.md
│   ├── corrected_script.md
│   ├── hook_options.md
│   ├── rewrite_draft.md
│   ├── deepened_draft.md
│   ├── style_draft.md
│   ├── review_report.md
│   ├── ending_poem.md
│   ├── publish_package.md
│   └── memory_update.md
├── final/
│   ├── voiceover.md
│   └── subtitle.md
└── logs/
    └── workflow_log.md
```

## 3. 使用流程

1. 运行 `scripts/new_project.sh <项目名>`。
2. 把原始口播稿放入 `projects/<项目名>/input/original_script.md`。
3. 对 AI 说：`请运行 media-workflow 处理 projects/<项目名>`。
4. AI 必须先提取原视频的金句、情绪句、悬念句、类比和节奏。
5. AI 必须暂停询问用户：哪些原视频表达手法要学习，哪些不要。
6. 用户确认后，AI 再进入改写、深化、审查和生成。
7. 最终只交付：
   - `projects/<项目名>/final/voiceover.md`
   - `projects/<项目名>/final/subtitle.md`

## 4. 必须询问的节点

默认是半自动模式，不允许静默跑完全流程。

必须询问：

1. 原视频学习：要学习哪些金句、情绪句、悬念句、类比和节奏？
2. 开头方向：悬念型、反差型、强事实冲击型、年代共情型，选哪种？
3. 风格方向：更有画面、更有知识密度、更有情绪、更克制，选哪种？
4. 风险处理：事实存疑、敏感词、过强表达，是删除、弱化还是补证据？
5. Memory：本次经验是否写入 `memory/content_memory.md`？

## 5. 内容原则

严谨不是写平。

正确理解：

- 要有悬念，但不能造假。
- 要学原视频的金句和情绪节奏，但不能照搬。
- 要有画面感、类比、反差、尺度感。
- 要理性、客观，不煽动、不制造对立。
- 要保留能打动人的表达，而不是把稿子改成说明文。

## 6. 当前样例项目

已创建样例：

```text
projects/2026-05-16-yellow-river/
```

最终稿：

- `projects/2026-05-16-yellow-river/final/voiceover.md`
- `projects/2026-05-16-yellow-river/final/subtitle.md`

过程稿：

- `projects/2026-05-16-yellow-river/process/source_extraction.md`
- `projects/2026-05-16-yellow-river/process/review_report.md`
- `projects/2026-05-16-yellow-river/process/publish_package.md`

