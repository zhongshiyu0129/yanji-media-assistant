# Rewrite And Deduplication

Goal: reduce similarity by rebuilding structure and expression, not by simple synonym replacement.

## Rewrite strategy

- Reorder argument flow.
- Replace the original author's distinctive phrasing.
- Keep stable facts and core topic, but rebuild expression.
- Add the user's point of view where supported by local materials.
- Remove repetitive, empty, or marketing-heavy content.
- Avoid more than 12 consecutive identical Chinese characters from the source, except fixed terms and proper nouns.

## Originality guardrails

- Do not preserve the original rhetorical sequence if it is distinctive.
- Do not preserve punchlines from the original.
- Do not imitate another creator's personal catchphrases.
- Do not invent details to create difference.

## Output file

Write `projects/<slug>/process/rewrite_draft.md`.

Use this structure:

```markdown
# 03 降重改写稿

## 改写后正文

## 保留信息清单

## 新增表达清单

## 删除内容清单

## 相似风险提示
```
