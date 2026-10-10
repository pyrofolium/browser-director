# Plan format (version 1)

A plan is strict JSON. Unknown properties are errors. See the installed CLI's `init` output for a working example.

```json
{
  "version": 1,
  "url": "${DEMO_URL}",
  "viewport": {"width": 1440, "height": 900},
  "ready": "#workspace",
  "steps": [
    {"action":"pause", "camera":"wide", "holdMs":1200},
    {"action":"type", "target":"#name", "text":"Example"},
    {"action":"click", "target":"#create", "camera":{"target":"#form"},
     "expect":{"target":"#result", "text":"Created"}},
    {"action":"focus", "target":"#result", "audio":"result.wav", "holdMs":1000}
  ]
}
```

Top-level: `version`, `url`, optional `viewport` (1440×900), `ready` (CSS selector), `timeoutMs` (15000), `prepare` (unrecorded steps), `steps` (1–100), `tailMs` (1000, minimum 650 for the final zoom-out).

All steps support `label`, `holdMs` (1200), `audio` (relative to the plan), `expect` (`target`, optional text substring), and `camera`.

| Action | Required | Behavior |
|---|---|---|
| `click` | `target` | Smooth cursor approach and actionable click |
| `type` | `target`, `text` | Clears input then types; `delayMs` defaults to 45 |
| `focus` | `target` | Frames and points, without clicking |
| `scroll` | `target` | Centers the element before the next beat |
| `wait` | `target` | Waits for visibility; optional `text` substring |
| `press` | `key` | Playwright keyboard key, e.g. `Enter` |
| `pause` | — | Holds the current view |

Selectors are CSS (including Playwright CSS extensions); each must resolve uniquely. Open shadow roots are supported. Iframes are not supported in v1.

Camera: `"wide"` or `{ "target":"#region", "padding":70, "maxZoom":1.8, "durationMs":650 }`. Click/type/focus default to framing their target. The camera fits the entire region and clamps to the viewport; it will reduce zoom rather than crop the region. Regions must be fully visible. Scroll first or use a smaller region if necessary.

When a target needs scrolling, the view pulls back briefly and centers it. This avoids silently tracking a stale position after scrolling. Camera motion uses smooth acceleration/deceleration. The cursor is rendered in the real page and follows its camera crop.

Audio starts after the camera settles. A step holds for at least `holdMs` after the action and until its audio ends (+180ms). Use one audio segment per visual beat. Audio is mixed at its original level; normalize narration beforehand. Browser/system audio is not captured. No speech synthesis or voice credential is bundled.

Recording outputs: `capture/*.webm`, `recording.json`, `step-NN.png`; rendering adds `demo.mp4`, `demo.mp4.chapters.json`, `render.ffgraph`. Keep the original capture and audio paths accessible for re-rendering. Do not edit a failed manifest to force rendering.

Commands:
```
browser-director record plan.json --out take-1
browser-director render take-1/recording.json --output take-1/revised.mp4
browser-director run plan.json --out take-2 --headed --state .sessions/demo.state.json
browser-director install-skill                 # both agents
browser-director install-skill --codex         # Codex only
browser-director install-skill --claude        # Claude Code only
```

Codex destination: `$CODEX_HOME/skills/browser-director` when set, otherwise `~/.agents/skills/browser-director`. Claude destination: `${CLAUDE_CONFIG_DIR:-~/.claude}/skills/browser-director`. Installation updates unmodified shipped files and refuses to overwrite personal edits unless `--force` is supplied. Restart the agent session to discover a newly installed skill.
