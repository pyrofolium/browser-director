---
name: browser-director
description: Record real browser walkthroughs from a scripted plan, with smooth zooms, cursor movement, and optional synchronized narration. Use for website demo videos and tutorials, not ordinary browser inspection or synthetic slide animation.
---

# Browser Director

Use `browser-director` to record a real browser and render its camera moves into an MP4. It runs locally; it does not call an LLM or a speech service.

## Workflow

1. Run `browser-director doctor`; use `browser-director setup` if Chromium is missing. `browser-director init <new-directory>` creates a self-contained runnable example.
2. Inspect the actual target site's DOM using available browser tools. Build a plan with stable, unique CSS selectors. Read [the plan reference](references/plans.md) before authoring it.
3. Explain the goal before individual controls. Start wide, show the action, then frame its result. Use a region around the target to preserve useful context. Avoid zooming onto a large mostly empty editor container; target the visible code or a smaller region.
4. Validate, record, and render:
   ```sh
   browser-director validate plan.json
   browser-director run plan.json --out take-1
   ```
5. Inspect `take-1/demo.mp4`, the per-step screenshots, and `recording.json`. Verify the action succeeded, the camera contains the relevant content, and narration matches the screen. Screenshots alone do not verify motion or audio. Refine and use a new take directory.

## Narration and timing

Use supplied audio files per step. The CLI starts each file after the camera settles, alongside the action, and waits for the complete audio before proceeding. Divide narration into small beats when a sentence describes several screen changes. A single long audio file attached to one step holds that view; it cannot infer phrase-level changes. Use `focus` beats to explain without clicking. Include brief overview/transition beats. Record at normal speed.

## Sessions and real actions

Plans perform actual actions on the website. Stay within the user's authorized scope, use reversible drafts or a demo workspace where possible, and never click Save/Send/Delete merely to get a shot. Do not interpret access to a page as permission to publish its contents.

Use `browser-director login URL --state .sessions/demo.state.json` for interactive login, then pass `--state` to `run`. Session files contain credentials. Never commit or upload sessions, private URLs, raw recordings, or screenshot evidence without authorization. Use `${DEMO_URL}` in reusable plans.

The CLI fails on ambiguous selectors, blocked clicks, failed assertions, and camera regions outside the viewport. Diagnose the screenshot and error; do not silently select another control. `prepare` steps happen before the recording starts but still perform real actions.

## Editable camera

`record` saves footage plus `recording.json`; `render` can render again without redoing browser actions. Camera cues contain timestamps and explicit starting/ending crop poses. Keep the complete manifest and raw capture together. Failed takes cannot be rendered as successes.
