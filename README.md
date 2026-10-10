# Browser Director

**Turn a planned browser walkthrough into a video with smooth zooms, deliberate cursor movement, and synchronized narration.**

Browser Director opens a real Chromium browser, performs your scripted actions, records the page, and renders an MP4. You choose what the viewer should see at each step. No LLM, cloud rendering service, or paid rendering engine is required.

## Install

```sh
brew install pyrofolium/tap/browser-director
browser-director setup
browser-director doctor
```

The Homebrew formula installs Node and FFmpeg. `setup` downloads the matching Playwright Chromium into your user cache. macOS and Linux are supported; Linux may need [Playwright system dependencies](https://playwright.dev/docs/browsers#install-system-dependencies).

From source (Node 22+ and FFmpeg/ffprobe required):

```sh
git clone https://github.com/pyrofolium/browser-director.git
cd browser-director
npm ci
npm link
browser-director setup
```

## Try it in one minute

```sh
browser-director init my-demo
browser-director run my-demo/plan.json --out my-demo/take-1
```

Open `my-demo/take-1/demo.mp4`. This example runs entirely locally, without an account. It types a release name, creates a checklist, zooms to the result, and returns to the overview.

Every take uses a new directory so an unsuccessful run cannot masquerade as an old successful video.

## Give your agent the skill

```sh
browser-director install-skill           # Codex and Claude Code
browser-director install-skill --codex   # only Codex
browser-director install-skill --claude  # only Claude Code
```

Like bigarrow, this installs a bundled skill that teaches the agent the workflow. It does **not** change system prompts or agent settings. Restart your agent session to discover it. Then ask:

> Use browser-director to record a walkthrough of creating a project. Start with the overview, zoom to the name field while typing, then show the created project. Inspect the resulting video and refine its framing.

Codex uses `~/.agents/skills/browser-director` (or `$CODEX_HOME/skills/browser-director` when set). Claude Code uses `~/.claude/skills/browser-director` (or `$CLAUDE_CONFIG_DIR/skills/browser-director`). Reinstalling updates untouched files; edited files are protected unless you pass `--force`.

## Direct your own recording

```json
{
  "version": 1,
  "url": "${DEMO_URL}",
  "ready": "#workspace",
  "steps": [
    {"action":"pause", "camera":"wide", "holdMs":1200},
    {"action":"type", "target":"#name", "text":"Spring release",
     "camera":{"target":"#create-form"}},
    {"action":"click", "target":"#create", "expect":{"target":"#result", "text":"Created"}},
    {"action":"focus", "target":"#result", "audio":"result.wav"}
  ]
}
```

```sh
export DEMO_URL='https://your-demo-site.example'
browser-director validate plan.json
browser-director run plan.json --out take-1 --headed
```

`target` identifies the control. `camera.target` identifies the region that should stay visible, which can include its label and surrounding controls. The camera fits that region rather than blindly zooming in and cutting it off. Actions use unique selectors and Playwright's click checks. Assertions make the recording stop when the expected result does not appear.

Read the **[complete plan reference](skill/references/plans.md)** for actions, framing, timings, authentication, and outputs.

### Narration

Supply an audio file for each visual beat. Playback begins after its camera transition, alongside the action. The next step waits until the audio finishes. A long explanation should be divided into beats if its subject changes on screen.

This release accepts existing narration; it does not synthesize speech, infer timing from a transcript, or capture browser/system audio. Audio retains its supplied level. Prepare consistent volume before recording.

### Sign in once

```sh
browser-director login https://your-demo-site.example --state .sessions/demo.state.json
browser-director run plan.json --out take-2 --state .sessions/demo.state.json
```

Sign in in the opened browser, then press Enter in the terminal. Session files contain credentials and are written with owner-only permissions. Keep them out of version control. Recordings also contain whatever the page shows; inspect them before sharing. Plans execute real clicks, so use a demo workspace or reversible actions.

### Re-render without repeating actions

```sh
browser-director record plan.json --out take-3
browser-director render take-3/recording.json --output take-3/demo.mp4
```

The recording includes real footage, per-step screenshots, camera poses, audio timings, and action timestamps. Advanced users can edit the camera cues in `recording.json` and render a new output without interacting with the website again. Keep the raw footage and audio files at their recorded paths.

## How it works

1. Playwright loads the page, runs optional setup steps, and records actual browser frames.
2. A short calibration frame aligns the footage with action timestamps; it is removed from the final video.
3. Camera regions are measured from the DOM. Smooth transitions fit the full region and stay inside the viewport.
4. FFmpeg renders the camera motion and mixes supplied audio at the recorded timestamps. Playback stays at normal speed, at 30 fps and the recording viewport's resolution.

The rendered cursor is injected into the page and recorded with it. It is not a reconstruction of the website. Per-step PNGs are diagnostic evidence, not the video source.

## Current boundaries

- Desktop Chromium and one page per take. No iframe controls, popup workflows, mobile-device emulation, or native desktop apps yet.
- CSS selectors, including Playwright CSS extensions and open shadow roots.
- Camera regions must fit entirely in the viewport. Oversized/hidden regions produce an error; scroll or choose a smaller region.
- Page animations remain real; this tool does not automatically remove application loading delays or repair a slow website.
- No automatic redaction. Keep private page data, session state, and recordings out of public repositories.
- A scripted capture can fail if the page changes. It reports failure rather than guessing a different control.

## Development

```sh
npm ci
npm test
npm run test:e2e
```

The end-to-end test launches Chromium, records the bundled example, renders a video with timed audio, checks media streams and duration, and verifies failed takes cannot render.

## License and acknowledgments

Browser Director is MIT-licensed. Playwright is Apache-2.0; Zod is MIT. FFmpeg is separately distributed under LGPL/GPL depending on its build, including the encoders enabled by your package manager. There is no Remotion dependency or company-seat rendering license.

The design was informed by evaluating [programatic-demo](https://github.com/ashrafchowdury/programatic-demo), especially its real-browser recording approach, and by [bigarrow](https://github.com/franzenzenhofer/big-arrow-on-the-screen)'s skill-installation UX. This implementation is new code, not a bundled copy of those projects.
