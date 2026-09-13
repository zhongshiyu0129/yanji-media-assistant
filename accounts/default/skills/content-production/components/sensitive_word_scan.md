# Sensitive Word Scan

Use this component when creating the review report and safe subtitles.

## Scan sources

- `materials/compliance/sensitive_words.md`
- `materials/compliance/replacement_rules.md`
- `materials/compliance/platform_rules.md`
- `materials/compliance/douyin_wechat_sensitive_guidance.md`
- General high-risk categories when local lists are missing.

## High-risk categories

- Absolute claims: 最, 第一, 唯一, 保证, 绝对.
- Financial promises: 暴富, 稳赚, 保本, 翻倍.
- Medical promises: 根治, 药到病除, 永不复发.
- Legal certainty without basis.
- Personal attacks.
- Vulgar or violent wording.
- Policy misinterpretation.
- Extreme conflict or hatred.
- Country/politics, military, territorial disputes, and sensitive policy over-interpretation.
- War, weapons, bloody scenes, self-harm, and dangerous imitation.
- Disease names, prescription drugs, treatment promises, medical devices, and folk remedies.
- External traffic diversion, counterfeit goods, and false advertising.
- Minor protection risks, campus violence, premature romance framing, dangerous imitation, and appearance anxiety.
- Sexual innuendo, soft porn, vulgar memes, feudal superstition, regional discrimination, and misuse of national symbols.

## Handling priority

1. Remove if the sentence can stand without it.
2. Weaken if removal damages meaning.
3. Replace with a safer expression if local rules provide one.
4. Mark for human review if meaning or compliance is uncertain.

## Source note

When using `douyin_wechat_sensitive_guidance.md`, treat its official-basis statements as user-provided local reference unless separately verified. In review output, phrase it as "根据本地合规参考资料" rather than claiming independent official verification.

## Voiceover vs subtitle

- Voiceover can preserve nuance if safe enough.
- Subtitle should be more conservative.
- Do not use misleading homophones or symbols to evade review.
