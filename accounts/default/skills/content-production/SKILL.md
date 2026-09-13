---
name: content-production
description: Use this skill to produce, rewrite, review, and package self-media short-video voiceover scripts from local materials. It handles light correction, viral hooks, deduplication rewrite, length control, content deepening, style infusion, fact and compliance review, safe subtitles, elevated endings with a four-line rhymed poem, publish titles/cover text/descriptions/tags, and memory update suggestions. Use this whenever the user asks for short-video script production, rewritten voiceover drafts, subtitles, sensitive-word cleanup, or publishing copy.
---

# Content Production

This skill performs the content work for the self-media assistant. It is usually invoked by `../media-workflow/SKILL.md`.

Keep this file as the operating map. Load reference files only when the relevant stage is reached.

## Required inputs

- Source script: `materials/input/original_script.md`
- Memory: `memory/content_memory.md`

Use optional profile, ideas, facts, and compliance files when present.

## Reference map

- Interaction protocol: `references/00_interactive_revision.md`
- Source learning: `references/source_learning.md`
- Light correction: `references/01_correction.md`
- Hook opening: `references/02_hook_opening.md`
- Rewrite and dedup: `references/03_rewrite_dedup.md`
- Deepening and length control: `references/04_deepening_length.md`
- Style infusion: `references/05_style_infusion.md`
- Fact and compliance review: `references/06_review_fact_compliance.md`
- Subtitle safety: `references/07_subtitle_safety.md`
- Elevated ending and poem: `references/08_ending_poem.md`
- Publish package: `references/09_publish_package.md`
- Memory rules: `references/10_memory_rules.md`
- Output contract: `references/11_output_contract.md`

## Component map

- Sensitive word handling: `components/sensitive_word_scan.md`
- Subtitle splitting: `components/subtitle_split_rules.md`
- Duration estimation: `components/duration_estimation.md`
- Memory append format: `components/memory_append_template.md`

## Production order

1. Read `references/00_interactive_revision.md` and follow semi-automatic mode.
2. Read `references/11_output_contract.md` before writing output files.
3. Extract source gold lines, emotional lines, suspense devices, and visual metaphors using `references/source_learning.md`.
4. Pause for the source learning checkpoint unless the user explicitly requested full-auto.
5. Correct the source script using `references/01_correction.md`.
6. Rewrite the opening using `references/02_hook_opening.md`.
7. Rewrite for lower similarity using `references/03_rewrite_dedup.md`.
8. Deepen or adjust length using `references/04_deepening_length.md`.
9. Fuse account style using `references/05_style_infusion.md`.
10. Review facts, logic, and compliance using `references/06_review_fact_compliance.md`.
11. Revise into final voiceover using the review results.
12. Generate elevated ending and poem using `references/08_ending_poem.md`.
13. Generate safe subtitles using `references/07_subtitle_safety.md`.
14. Generate publish package using `references/09_publish_package.md` into process notes unless requested in final deliverables.
15. Generate memory update suggestions using `references/10_memory_rules.md`.

## Non-negotiable rules

- Do not change the source meaning during correction.
- Do not copy the original structure or distinctive phrasing during rewrite.
- Do not invent facts, data, named cases, sources, policies, or quotes.
- Strong hooks must be supported by the body.
- Strong hooks should still create curiosity, scale, visual imagination, or emotional momentum.
- Learn the original script's gold lines and emotional techniques before rewriting.
- High-risk facts must be weakened, removed, or marked for evidence.
- Safe subtitles may differ from the voiceover wording, but not the core meaning.
- The final voiceover must be directly recordable.
- Memory updates are suggestions until the user permits appending.

## Completion checklist

Before finishing, verify:

- Required project files exist under `projects/<slug>/process/`, `projects/<slug>/final/`, and `projects/<slug>/logs/`.
- Source gold lines and emotional techniques were extracted before rewriting.
- Review report includes factual, compliance, logic, and audience-understanding checks.
- Final voiceover includes a clear opening, dense body, elevated ending, and poem.
- Safe subtitle includes replacement notes or subtitle modification tips.
- Publish package includes titles, cover text, descriptions, tags, and a recommended combination.
- Memory update file avoids unverified facts and one-off noise.
