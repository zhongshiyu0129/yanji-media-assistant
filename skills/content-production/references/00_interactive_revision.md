# Interactive Revision Protocol

Default mode: semi-automatic.

Ask only when the answer materially changes the output. Prefer option-based questions and keep each stop short.

## Decision points

### 1. Source learning checkpoint

This checkpoint is mandatory after `source_learning.md` extracts the original script's gold lines, emotional lines, suspense devices, and visual metaphors.

Ask the user which elements to learn:

- Keep the suspense style, but rewrite the facts.
- Learn the emotional rhythm and scale comparisons.
- Keep only the knowledge density, not the dramatic tone.
- Learn specific gold lines selected by the user.
- Avoid the original's emotional style and only use facts.

Do not continue into rewrite until the user chooses, unless the user explicitly requested full-auto.

### 2. Start

Ask if missing from the source:

- Target platform: Douyin, Video Account, Xiaohongshu, Bilibili, Kuaishou, or general.
- Target duration: 30s, 60s, 90s, 3min, or custom.
- Overall style: sharp, warm, plain-spoken, high-density, nostalgic, patriotic, restrained.
- Strong hook permission: mild, normal, strong.

Default: general platform, 90 seconds, plain-spoken high-density style, normal hook intensity.

### 3. Hook direction

Offer 2-3 options:

- Suspense + impossible fact.
- Contrast + scale comparison.
- Question + fast reveal.
- Nostalgic empathy.
- Strong spoken hook with evidence.

Default: suspense + contrast, unless the topic is sensitive.

### 4. Style and ending direction

Offer concise choices:

- More sharp and direct.
- More warm and resonant.
- More knowledge-dense.
- More nostalgic and empathetic.
- More elevated with family-country feeling.
- More restrained.

Default: plain-spoken, knowledge-dense, elevated but not melodramatic.

### 5. Review handling

For high-risk facts or compliance risks, ask whether to:

- Delete.
- Weaken.
- Keep but mark evidence needed.
- Pause for user-provided evidence.

Default: delete or weaken high-risk claims.

### 6. Memory update

After `projects/<slug>/process/memory_update.md`, ask whether to append to `memory/content_memory.md`.

Default: do not append unless the user allows it.

## Question format

Use this format:

```markdown
需要你确认一个修改方向：

A. [选项] - [影响]
B. [选项] - [影响]
C. [选项] - [影响]

默认我会选：[默认项]。
```

## Logging

Record all user choices in `projects/<slug>/logs/workflow_log.md`.
