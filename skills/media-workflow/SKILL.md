---
name: media-workflow
description: Use this skill whenever the user asks to run a self-media/short-video voiceover workflow, create a new script project, process a project under projects/<slug>, rewrite an extracted video script into the user's own voice, or output final voiceover and safe subtitles. This orchestration skill uses global memory plus one isolated project folder per script.
---

# Self-Media Project Workflow

Use this as the top-level controller. Each script task must live in its own project folder under `projects/<project-slug>/`.

## Architecture

- Account package: `accounts/<account-id>/`, selected by `projects/<slug>/context/account.yaml`.
- Default account package: `accounts/default/`.
- Account package contents include `profile/`, `memory/`, `skills/`, `ideas/`, `facts/`, and `compliance/`.
- Legacy global memory/profile paths may remain as fallback during the bridge phase.
- Project input: `projects/<slug>/input/original_script.md`
- Project selected materials: `projects/<slug>/input/selected_materials.md`
- Project material references: `projects/<slug>/input/material_refs.json`
- Project context: `projects/<slug>/context/project_brief.md`
- Project account selection: `projects/<slug>/context/account.yaml`
- Process artifacts: `projects/<slug>/process/`
- Final deliverables: `projects/<slug>/final/voiceover.md` and `projects/<slug>/final/subtitle.md`
- Logs: `projects/<slug>/logs/workflow_log.md`

## Creating a project

If the user asks to rewrite one collected material from `采集工作台/素材库/`, prefer the direct material-to-project entry:

```bash
python3 scripts/rewrite_material_project.py \
  --material "<material-md-path>" \
  --project <project-slug>
```

This copies the material content into `projects/<project-slug>/input/original_script.md` as the source input for rewriting. It must not modify the original material Markdown.

If the user asks to start a new blank project and no project folder exists, run:

```bash
scripts/new_project.sh <project-slug>
```

Then ask the user to paste the extracted script into:

```text
projects/<project-slug>/input/original_script.md
```

If the user wants to use extra collected materials as supporting context in addition to the main source, link them with:

```bash
python3 scripts/link_materials.py --project <project-slug> --material "<material-md-path>"
```

Linked supporting materials are references only. Do not edit original files under `../采集工作台/素材库/`.

## Default interaction mode

Semi-automatic mode is required. Do not silently run the whole workflow unless the user explicitly says full-auto.

Required discussion checkpoints:

1. Source learning checkpoint: confirm which original hooks, gold lines, emotional lines, metaphors, and rhythm should be learned.
2. Hook checkpoint: offer 2-3 suspense/hook directions before rewriting the opening.
3. Style checkpoint: confirm whether this draft should be more cinematic, knowledge-dense, emotional, restrained, or family-country oriented.
4. Review checkpoint: ask how to handle high-risk facts or sensitive expressions.
5. Memory checkpoint: ask before writing reusable lessons into `memory/content_memory.md`.

## Workflow

1. Identify the project folder. If none is provided, ask for or create a slug.
2. Check `projects/<slug>/input/original_script.md`.
3. Read `projects/<slug>/context/account.yaml`.
4. Resolve the account package path. Prefer `accounts/<account-id>/`, then fall back to `accounts/default/`, then legacy top-level paths.
5. Load account package memory, profile, ideas, facts, compliance files, and account-local skills.
6. Load `projects/<slug>/input/selected_materials.md` when present. Treat it as project context and evidence candidates, not as wording to copy.
7. Load the selected account's `skills/content-production/SKILL.md`; if missing, fall back to `skills/content-production/SKILL.md`.
8. First extract source gold lines and emotional technique into `projects/<slug>/process/source_extraction.md`, noting any selected materials that can support facts or examples.
9. Pause and ask the user what to learn from the original before rewriting.
10. Continue production stages into `projects/<slug>/process/`.
11. Write final deliverables only to:
   - `projects/<slug>/final/voiceover.md`
   - `projects/<slug>/final/subtitle.md`
12. Put optional publish copy, review report, and memory suggestions in `projects/<slug>/process/`, not in final.
13. Write `projects/<slug>/logs/workflow_log.md`.

## Deliverable rule

The final folder should stay clean:

- `final/voiceover.md`: recordable final script.
- `final/subtitle.md`: safe subtitle version.

All messy thinking, drafts, review notes, title options, and memory suggestions belong in `process/`.

## Quality posture

"Rigorous" does not mean flat. It means:

- Keep hooks vivid and suspenseful, but supported by facts.
- Learn the original's gold lines, emotional rhythm, metaphors, and curiosity gaps.
- Avoid false certainty, incitement, group opposition, and unsupported data.
- Preserve energy while making the expression the user's own.
