# Browser Director

A standalone MIT CLI. Keep private URLs, login state, production page data, and generated recordings out of this repository. The example is a self-contained fictional app.

- Node >=22, ESM JavaScript. `npm test` checks camera containment/continuity, strict plans, and safe skill updates. `npm run test:e2e` records and renders a real Chromium session; requires FFmpeg and `browser-director setup`.
- Capture real browser frames. Never substitute a reconstruction and describe it as the running site.
- Preserve recording/timing alignment. A failed action or absent sync marker must fail the take/render; never fall back to a plausible-looking success.
- Keep the skill reference, CLI help, and README consistent with the plan schema.
- Skill updates must protect locally edited files unless the user explicitly supplies `--force`.
- Release versions are immutable. Test the packed install and Homebrew formula before marking a release stable. Maintain the formula in pyrofolium/homebrew-tap.
