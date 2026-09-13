# Duration Estimation

Use this component when the user gives a target duration or when reporting script length.

## Default estimate

- Slow emotional delivery: 180-220 Chinese characters per minute.
- Normal spoken short-video delivery: 220-280 Chinese characters per minute.
- Fast high-density delivery: 280-330 Chinese characters per minute.

Default assumption: 250 Chinese characters per minute.

## Formula

```text
estimated_minutes = chinese_character_count / characters_per_minute
```

Report as an estimate, not an exact duration.

## Output note

Use:

```markdown
- 字数：
- 预计口播时长：
- 估算口径：
```

