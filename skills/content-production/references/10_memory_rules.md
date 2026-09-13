# Memory Rules

Goal: produce a memory update suggestion from the actual run.

Long-term memory file:

```text
memory/content_memory.md
```

## Record

- Reusable user preferences.
- Effective hooks.
- Effective endings.
- Effective title patterns.
- Repeated style instructions.
- Risky expressions that should be avoided.
- Review lessons from fact/compliance checks.

## Do not record

- One-off facts from a single script.
- Unverified claims as truth.
- User source material that belongs in `materials/ideas/`.
- Sensitive or high-risk wording as recommended wording.
- Noisy temporary edits.

## Output file

Write `projects/<slug>/process/memory_update.md`.

Use this structure:

```markdown
# 11 Memory 更新建议

## 建议追加到 content_memory.md

## 本次有效表达

## 本次踩坑记录

## 不建议写入长期 memory 的内容

## 是否需要用户确认
```
