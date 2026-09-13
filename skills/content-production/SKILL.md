---
name: content-production
description: Use this skill to produce, rewrite, review, and package self-media short-video voiceover scripts from local materials. It handles light correction, viral hooks, deduplication rewrite, length control, content deepening, style infusion, fact and compliance review, safe subtitles, elevated endings with a four-line rhymed poem, publish titles/cover text/descriptions/tags, and memory update suggestions. Use this whenever the user asks for short-video script production, rewritten voiceover drafts, subtitles, sensitive-word cleanup, or publishing copy.
---

# Content Production

This skill performs the content work for the self-media assistant. It is usually invoked by `../media-workflow/SKILL.md`.

Keep this file as the operating map. Load reference files only when the relevant stage is reached.

## Required inputs

- Source script: `projects/<slug>/input/original_script.md`
- Project brief: `projects/<slug>/context/project_brief.md`
- Account selection: `projects/<slug>/context/account.yaml`
- Account package memory: `accounts/<account-id>/memory/content_memory.md`
- Optional selected materials: `projects/<slug>/input/selected_materials.md`

When the project was created from a collected material, `original_script.md` may contain the imported material body under "原始素材". Treat this as the main source to rewrite. Do not edit the original Markdown file in `采集工作台/素材库/`.

Use account package profile, ideas, facts, and compliance files when present:

- `accounts/<account-id>/profile/`
- `accounts/<account-id>/ideas/`
- `accounts/<account-id>/facts/`
- `accounts/<account-id>/compliance/`

During the bridge phase, if an account package file is missing, fall back to the legacy top-level paths under `materials/`, `memory/`, and `skills/`.

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
3. Load the account package memory, profile, ideas, facts, and compliance context.
4. Load `projects/<slug>/input/selected_materials.md` if present. Use selected materials as references for facts, cases, examples, and viewpoint inspiration. Do not copy distinctive wording from selected materials.
5. Extract source gold lines, emotional lines, suspense devices, and visual metaphors using `references/source_learning.md`.
6. Pause for the source learning checkpoint unless the user explicitly requested full-auto.
7. Correct the source script using `references/01_correction.md`.
8. Rewrite the opening using `references/02_hook_opening.md`.
9. Rewrite for lower similarity using `references/03_rewrite_dedup.md`.
10. Deepen or adjust length using `references/04_deepening_length.md`.
11. Fuse account style using `references/05_style_infusion.md`.
12. Review facts, logic, and compliance using `references/06_review_fact_compliance.md`; selected materials may support claims, but unsupported facts must still be weakened, removed, or marked for evidence.
13. Revise into final voiceover using the review results.
14. Generate elevated ending and poem using `references/08_ending_poem.md`.
15. Generate safe subtitles using `references/07_subtitle_safety.md`.
16. Generate publish package using `references/09_publish_package.md` into process notes unless requested in final deliverables.
17. Generate memory update suggestions using `references/10_memory_rules.md`.

## Non-negotiable rules

- Do not change the source meaning during correction.
- Do not copy the original structure or distinctive phrasing during rewrite.
- Do not invent facts, data, named cases, sources, policies, or quotes.
- Do not mutate original collected materials imported or referenced from `采集工作台/素材库/`.
- Do not treat selected materials as text to imitate; treat them as context and evidence candidates.
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
- Account package was resolved from `projects/<slug>/context/account.yaml` or a documented fallback.
- If `selected_materials.md` exists, its material references were considered during fact/example planning.
- Source gold lines and emotional techniques were extracted before rewriting.
- Review report includes factual, compliance, logic, and audience-understanding checks.
- Final voiceover includes a clear opening, dense body, elevated ending, and poem.
- Safe subtitle includes replacement notes or subtitle modification tips.
- Publish package includes titles, cover text, descriptions, tags, and a recommended combination.
- Memory update file avoids unverified facts and one-off noise.
