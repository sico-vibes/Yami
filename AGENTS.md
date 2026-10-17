# Yami engineering guardrails

**Yami skill:** before working on Yami, and whenever the user mentions "the Yami skill", read `.claude/skills/yami/SKILL.md` and the reference files it points to. It covers the stack, project map, design language, recipes, verification and the required documentation update when you finish.

Yami is a Windows-first, free-first, MIT-licensed desktop companion. The GitHub repository stays private during development. Preserve user chats, settings and provider credentials.

- Every repository text file must contain at most **1,000 lines**. Split by responsibility before reaching the limit. Run `npm run check:lines`. Dependencies, build output, private test artifacts and binary assets are not authored source. Keep the machine-generated lockfile compact after npm updates; do not omit it.
- Optimize idle behavior first. Target 50–100 MB total private working set at idle and a 600–700 MB ceiling during ordinary tasks; these are targets, not current guarantees. Measure the complete process tree, including native helpers. Record baseline, hardware, settings and measurement method. Avoid idle polling, overlapping native queries, persistent animation and eager heavy imports.
- Spikes during useful work may be acceptable if bounded and memory returns afterward. Never trade away required features, consent, accessibility or responsiveness merely to pass a benchmark.
- Keep provider calls in the main process. Free API tiers have quotas and regional/data-use conditions. Do not silently enable billing or add paid dependencies. Future providers must preserve the explicit tool policy and user control.
- Use the browser preview (`npm run preview:web`) to revise shared React screens first. It must use temporary fixtures with no credentials, microphone recording, native actions or provider requests. Verify the resulting flow on Windows before claiming desktop completion.
- Keep full documentation in `Documentation/` and regenerate the standalone viewer with `npm run docs`. Root README and standard repository policy files are entry points. Distinguish shipped behavior, proposed ideas, measured results and unresolved reference gaps.
- Use Phosphor icons. The spirit character can use SVG. Reserve animation for interaction and active work; respect reduced motion.
- Do not commit API keys, user data, transcripts, private screenshots, downloaded reference assets, generated executables or local test profiles. Capture documentation screenshots using an isolated profile.
- Run relevant checks after changes: `npm run check`, `npm run build`, browser-preview checks and applicable native/packaged checks. Test no disruptive power/network action merely for coverage.

See `Documentation/development.md`, `Documentation/performance.md` and `Documentation/security-and-providers.md` for details.
