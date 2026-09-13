# Light Correction

Goal: fix obvious transcription and language issues without changing meaning.

## Allowed changes

- Typos and homophones.
- Punctuation.
- Sentence breaks.
- Repeated filler words.
- Obvious grammar issues.
- Suspected transcript errors, if clearly inferable from context.

## Forbidden changes

- Do not change claims, stance, or argument.
- Do not add new facts.
- Do not remove important information.
- Do not rewrite the structure for style at this stage.

## Output file

Write `projects/<slug>/process/corrected_script.md`.

Use this structure:

```markdown
# 01 轻度纠错稿

## 纠错后正文

## 修改说明
| 原表达 | 修改后 | 原因 |
|---|---|---|

## 疑似转写错误
| 原表达 | 疑点 | 建议 |
|---|---|---|
```
