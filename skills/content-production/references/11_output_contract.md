# Output Contract

Use project-based outputs. Do not write new workflow artifacts to global `materials/output/`.

## Project paths

For a project slug `<slug>`, write to:

```text
projects/<slug>/
├── input/original_script.md
├── context/project_brief.md
├── process/
├── final/
│   ├── voiceover.md
│   └── subtitle.md
└── logs/workflow_log.md
```

## Final deliverables

Only two files belong in `final/`:

- `final/voiceover.md`
- `final/subtitle.md`

Everything else belongs in `process/` or `logs/`.

## Process artifacts

Recommended process files:

- `process/source_extraction.md`
- `process/corrected_script.md`
- `process/hook_options.md`
- `process/rewrite_draft.md`
- `process/deepened_draft.md`
- `process/style_draft.md`
- `process/review_report.md`
- `process/ending_poem.md`
- `process/publish_package.md`
- `process/memory_update.md`

## Final voiceover format

Write `projects/<slug>/final/voiceover.md`:

```markdown
# 最终口播稿

## 标题建议

## 口播稿

## 拍摄提示
- 情绪：
- 语速：
- 停顿：
- 重音：
```

The voiceover body should be clean and directly recordable. Do not include internal tables or review notes in the final body.

## Final subtitle format

Write `projects/<slug>/final/subtitle.md`:

```markdown
# 字幕安全版

## 字幕正文

## 字幕修改提示
```

## Logs

Write `projects/<slug>/logs/workflow_log.md`:

```markdown
# Workflow Log

## Project

## User choices

## Source learning

## Outputs

## Risks

## Memory
```

