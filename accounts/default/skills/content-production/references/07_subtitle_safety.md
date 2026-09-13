# Subtitle Safety

Goal: produce a safer subtitle version and a modification note.

## Rules

- The subtitle version prioritizes lower platform risk.
- It may differ from the voiceover wording but must preserve the core meaning.
- Replace, weaken, or remove sensitive words and high-risk claims.
- Do not create misleading euphemisms.
- Keep each subtitle line short and readable.
- Use `components/sensitive_word_scan.md` and `components/subtitle_split_rules.md`.

## Output file

Write `projects/<slug>/final/subtitle.md`.

Use this structure:

```markdown
# 08 字幕安全版

## 字幕正文

## 字幕修改提示

## 替换记录
| 原表达 | 修改后 | 原因 |
|---|---|---|

## 仍需人工确认
```
