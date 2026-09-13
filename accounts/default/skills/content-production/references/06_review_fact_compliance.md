# Fact, Logic, And Compliance Review

Goal: review whether the draft is true, safe, logical, and understandable.

## Review roles

Use these perspectives in one report:

- Fact checker: data, years, people, organizations, policies, causal claims.
- Platform reviewer: sensitive words, prohibited claims, absolute language, exaggerated benefits, medical/financial/legal risk.
- Logic editor: jumps in reasoning, concept switching, over-attribution.
- Audience reviewer: possible misunderstanding, missing background, clickbait risk.

## Evidence priority

1. `materials/facts/` local files.
2. Source notes in `materials/input/original_script.md`.
3. Model knowledge only as preliminary screening.
4. If internet verification is needed, list questions and ask the user before browsing.

## Risk levels

- Low: does not affect the core claim.
- Medium: lacks support and should be softened.
- High: likely false, exaggerated, legally risky, platform risky, or evidence is required.

## Output file

Write `projects/<slug>/process/review_report.md`.

Use this structure:

```markdown
# 06 多 AI 审查报告

## 总体结论
- 可信：
- 存疑：
- 高风险：
- 违禁词/敏感词：
- 逻辑问题：

## 事实风险
| 原文表述 | 风险等级 | 核查结果 | 建议处理 | 依据 |
|---|---|---|---|---|

## 违禁词与敏感表达
| 原表达 | 风险类型 | 建议替换 | 是否已处理 |
|---|---|---|---|

## 逻辑与观众理解问题
| 位置 | 问题 | 建议 |
|---|---|---|

## 需要用户补充资料的问题

## 建议删除或弱化的内容
```
