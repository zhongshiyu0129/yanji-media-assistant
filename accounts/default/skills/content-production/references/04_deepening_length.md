# Deepening And Length Control

Goal: turn thin or incomplete material into a complete, dense, plain-spoken voiceover while controlling target length.

## Trigger when

- The source is only a fragment.
- The source has claims but no reasoning.
- The source has low information density.
- The user asks to expand, shorten, or fit a target duration.

## Method

- Build a complete voiceover structure: hook, topic, key point, explanation, example, turn, ending.
- Explain complex ideas in plain language.
- Add background, cause-effect chain, comparison, and examples only when supported by local materials or clearly marked as reasoning.
- Mark new factual claims as user material, general reasoning, or evidence needed.
- Estimate duration using `components/duration_estimation.md`.

## Useful spoken patterns

- "今天我用一条视频讲清楚..."
- "这件事真正重要的不是...而是..."
- "听完你就会明白，为什么很多人一直搞反了。"
- "这不是一句口号，而是和每个人都有关的现实问题。"

## Output file

Write `projects/<slug>/process/deepened_draft.md`.

Use this structure:

```markdown
# 04 内容深化与字数控制稿

## 深化后正文

## 新增内容来源
| 内容 | 来源类型 | 是否需核查 |
|---|---|---|

## 字数与时长
- 字数：
- 预计口播时长：
```
