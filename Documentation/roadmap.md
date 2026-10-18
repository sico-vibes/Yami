# Roadmap

This page separates implemented behavior from future ideas. Only features described as shipped in [Features and settings](features-and-settings.md) are present in the current application. Items below are ideas, not commitments or completed work.

## Implemented in the development checkout

- **Terminal.** Interactive ConPTY sessions, configurable app/hotkey launch, Yami backgrounds, bounded scrollback and owned process cleanup passed source and unpacked Windows checks. This is separate from the opt-in assistant PowerShell tool.
- **AI sessions, usage and connections.** The AI workspace includes hook activity/decisions, subscription quota readers, seven read-only service connectors, selected context, local model chat, HTTP MCP and local recaps. Live accounts and installed agent versions remain verification gaps.
- **Notes and dictation.** Searchable local notes, explicit recording/transcription, summaries/proposed Desk actions, dictionary/snippets and installed Windows speech are implemented. Synthetic offline speech passed; live capture/device checks remain outstanding. See the [workspace guide](workspace.md) for scope and limitations.

## Planned ideas (not shipped)
- **Deeper utilities.** Additional Windows system panels, app controls, and integrations may be explored after current utilities have clear permissions, support checks, and data flow.
- **Animation.** The cat spirit’s flame now flickers while active and settles at idle, with an optional Living flame. Further ideas: eyes that follow the cursor, more roaming reactions, and a hop out of the island at startup.
- **Provider extensions.** The provider layer could support optional alternatives behind a clear capability interface. There is no general plug-in API, provider marketplace, or guaranteed compatibility today.
- **Performance work.** Measure the packaged process tree against the [Windows-first budgets](performance.md), then reduce idle polling and activity only when changes preserve shortcut, tray, clipboard, and schedule behavior.

## Candidate improvements and lightweight constraints

These are proposed design choices inferred from the upstream examples, not measurements of those projects or promises that Yami already implements them. See the [research notes](research-and-references.md) for source dates and community discussions.

| Priority | Improvement | Proposed approach and resource constraint | Reference / inspiration |
| --- | --- | --- | --- |
| First | Lower the idle floor | Profile each Electron process, lazy-load hidden screens, and consider a native shell prototype if the renderer floor cannot meet the budget. Compare equivalent features before changing runtimes. | [Nectar](https://github.com/kua8/Nectar), [Windows development discussion](https://news.ycombinator.com/item?id=47475938) |
| First | Event-driven Windows status | Replace repeated PowerShell startup with persistent native notifications where supported. Keep fallback refresh bounded and coalesce concurrent readers. | [PowerToys](https://github.com/microsoft/PowerToys); independent utility boundaries |
| Next | Small local notes | Start with plain text/Markdown and indexed search on demand. No background cloud sync, embedded web editor, or permanent indexing loop by default. | [Flow Launcher](https://github.com/Flow-Launcher/Flow.Launcher); fast keyboard-oriented discovery |
| Next | Interactive Yami Terminal | App/hotkey launch, real PTY input/output, bounded scrollback, cleanup, and customizable Yami background. Preserve the AI advanced-tool consent boundary; avoid an always-running shell server. | [Terax source review](research/adaptation-review.md#terax-the-requested-terminal-is-feasible) |
| Next | Optional utility modules | Let people disable unused panels and stop their timers, subscriptions and helpers. Add utilities only after their Windows support and idle cost are measured. | [PowerToys](https://github.com/microsoft/PowerToys), [open-source Windows app discussion](https://www.reddit.com/r/windows/comments/wlc4ov/open_source_windows_apps_you_might_have_not_heard/) |
| Explore | Local dictation option | Load a speech model only for an explicit session, then offer unloading. Local model RAM may exceed this project's task ceiling, so reject unsuitable defaults rather than calling local inference inherently lightweight. | [Handy](https://github.com/cjpais/Handy) |
| Shipped | Richer spirit motion | The cat spirit animates during active work and short interactions, stays still at idle, respects reduced motion, and uses a small roaming window rather than a full-screen surface. Measure the roaming window’s cost before release. | [Nectar](https://github.com/kua8/Nectar); visual reference only, with no GPL code or assets copied |
| Later | Additional AI providers | Introduce a capability adapter for text, vision, audio and tools; keep keys in the main process. Free-first remains the default. Any paid provider must be optional and explicitly configured. | [Provider architecture](architecture.md), [lightweight-app expectations](https://www.reddit.com/r/windows/comments/6uwixq/what_are_your_top_lightweight/) |

## How roadmap items become shipped

The development checkout now implements the selected terminal, local notes,
Windows dictation and AI workspace adaptations. See the [workspace guide](workspace.md)
for the actual scope and verification matrix. The earlier table's proposed
terminal/notes items should be read with this implementation update. Remaining
work includes real account/service checks, installed CLI compatibility and audio
device testing; GPU terminal rendering, WSL/panes, bundled Whisper, mobile relay,
automatic MCP tools and full IDE features have not been implemented.

A roadmap idea should move into shipped documentation only after its code, settings, permission behavior, privacy impact, platform support, tests or manual verification, and asset/dependency licensing are available in the repository. Preserve local user data and provider keys during changes. State platform limits and provider costs/quotas directly.

Named upstream feature adaptations must also follow the [adaptation rules](adaptation.md): preserve the selected feature's backend/operating semantics and prove parity through Yami's existing design language. The [Coucou, Terax and CodeNotch review](research/adaptation-review.md) records pinned sources, proposed scope and unresolved Windows checks.

## Not a parity promise

Yami is a reconstruction from supplied references. Exact original prompts, hidden screens, private provider configuration, cosmetic unlock rules, and animation timing are not known. Future work will improve Yami as an open-source Windows app; it cannot certify that unknown original behavior has been recreated.
