# Roadmap

This page separates implemented behavior from future ideas. Features described as shipped in [Features and settings](features-and-settings.md) are in the application on `main`. Items under "Planned ideas" are not commitments or completed work.

## Implemented on main (not publicly released)

- **Terminal.** Interactive ConPTY sessions, configurable app/hotkey launch, Yami backgrounds, bounded scrollback and owned process cleanup passed source and unpacked Windows checks. This is separate from the opt-in assistant PowerShell tool.
- **AI sessions, usage and connections.** The AI workspace includes hook activity/decisions, subscription quota readers, seven read-only service connectors, selected context, local model chat, HTTP MCP and local recaps. Live accounts and installed agent versions remain verification gaps.
- **Notes and dictation.** Searchable local notes, explicit recording/transcription, summaries/proposed Desk actions, dictionary/snippets and installed Windows speech are implemented. Synthetic offline speech passed; live capture/device checks remain outstanding. See the [workspace guide](workspace.md) for scope and limitations.
- **File wheel.** Drag a file and tap a modifier, or use the Explorer shortcut, Send to, or the drop shelf, to convert a file or run a tool. Helper programs download on first use and are checked against pinned SHA-256 values. Merged to `main` on 2026-10-18 and included in the local portable build. The Windows drag, hotkeys and engine downloads have not yet been exercised on Windows. See [File wheel](file-wheel.md).

## Planned ideas (not shipped)

The owner-approved direction and phase order are in the [expansion plan (2026-10-27)](research/expansion-plan-2026-10-27.md). It covers optional modules with first-run choices and downloadable packs, the Nightglow revamp, the Dev and AI hub, Whistle dictation, Windows Tune and Style, file-wheel parity, media, feeds and mail, remote servers, and the Yami Browser. All ten phases are built and on `main`, and shipped in the public 0.3.0 beta (2026-10-30). [Features and settings](features-and-settings.md) says what each part does and how it was checked; it also names what is not built and what was not exercised live (for example, signed-in Outlook and Bluesky accounts, a real phone on Yami Remote and physical key presses for accent characters and quick look). The network shield was checked live on a real adapter on 2026-10-29.

The [next additions note (2026-10-29)](research/next-additions-2026-10-29.md) proposes what to add after the expansion: PowerToys-style utilities built natively (keep awake, color picker, always on top, window layouts, quick accent, hosts and environment editors), free keyless data (Frankfurter, Nager.Date, Open-Meteo air quality, Radio Browser, iTunes podcast search, OSV.dev), and companion ideas (daily brief, focus sessions, clipboard actions).

The ranked list of feature ideas, with their references, code review, costs, and guardrails, is in the [feature recommendations note (2026-10-18)](research/feature-recommendations-2026-10-18.md). Its Tier 1 items (Theme Hub, cursor manager, a launcher on the Windows Search index, keep-awake, an island OSD, a window switcher with snap zones, and scheduled theme and wallpaper changes) are the proposed starting point. None of them is implemented yet.


- **Deeper utilities.** Additional Windows system panels, app controls, and integrations may be explored after current utilities have clear permissions, support checks, and data flow.
- **Animation.** The cat spirit's flame now flickers while active and settles at idle, with an optional Living flame. Further ideas: eyes that follow the cursor, more roaming reactions, and a hop out of the island at startup.
- **Provider extensions.** The provider layer could support optional alternatives behind a clear capability interface. There is no general plug-in API, provider marketplace, or guaranteed compatibility today.
- **Performance work.** Measure the packaged process tree against the [Windows-first budgets](performance.md), then reduce idle polling and activity only when changes preserve shortcut, tray, clipboard, and schedule behavior.

## Candidate improvements and lightweight constraints

These are proposed design choices inferred from the upstream examples, not measurements of those projects or promises that Yami already implements them. See the [research notes](research-and-references.md) for source dates and community discussions.

| Priority | Improvement | Proposed approach and resource constraint | Reference / inspiration |
| --- | --- | --- | --- |
| First | Lower the idle floor | Profile each Electron process, lazy-load hidden screens, and consider a native shell prototype if the renderer floor cannot meet the budget. Compare equivalent features before changing runtimes. | [Nectar](https://github.com/kua8/Nectar), [Windows development discussion](https://news.ycombinator.com/item?id=47475938) |
| First | Event-driven Windows status | Replace repeated PowerShell startup with persistent native notifications where supported. Keep fallback refresh bounded and coalesce concurrent readers. | [PowerToys](https://github.com/microsoft/PowerToys); independent utility boundaries |
| Next | Optional utility modules | Let people disable unused panels and stop their timers, subscriptions and helpers. Add utilities only after their Windows support and idle cost are measured. | [PowerToys](https://github.com/microsoft/PowerToys), [open-source Windows app discussion](https://www.reddit.com/r/windows/comments/wlc4ov/open_source_windows_apps_you_might_have_not_heard/) |
| Explore | Bundled local speech model | Windows speech recognizers are already available. A bundled local model would load only for an explicit session, then offer unloading. Local model RAM may exceed this project's task ceiling, so reject unsuitable defaults rather than calling local inference inherently lightweight. | [Handy](https://github.com/cjpais/Handy) |
| Shipped | Richer spirit motion | The cat spirit animates during active work and short interactions, stays still at idle, respects reduced motion, and uses a small roaming window rather than a full-screen surface. Measure the roaming window's cost before release. | [Nectar](https://github.com/kua8/Nectar); visual reference only, with no GPL code or assets copied |
| Later | Additional AI providers | Introduce a capability adapter for text, vision, audio and tools; keep keys in the main process. Free-first remains the default. Any paid provider must be optional and explicitly configured. | [Provider architecture](architecture.md), [lightweight-app expectations](https://www.reddit.com/r/windows/comments/6uwixq/what_are_your_top_lightweight/) |

## How roadmap items become shipped

The selected terminal, local notes, Windows dictation, AI workspace and file wheel are on `main`. See the [AI workspace and terminal guide](workspace.md) and the [File wheel guide](file-wheel.md) for scope and verification. Still open: live account and service checks, installed agent CLI compatibility, audio device testing, the Windows drag check, GPU terminal rendering, WSL and panes, a bundled Whisper-class model, a mobile relay, automatic MCP tools, OCR, and full IDE features.

**Nightglow gaps (open, 2026-10-18).** The Nightglow redesign is on `main` and was checked only in the browser preview at 1160×790 and 850×610. Still open:

- The native date and time picker in Plans is still the Windows control; only its icon is tinted.
- Nightglow was checked in the packaged Windows app on 2026-10-28 (main window and Settings, from `npx electron-builder --win --dir`).
- Idle memory was re-measured on the `yami-expansion` branch on 2026-10-28: 168.0–168.1 MB private working set for the packaged build (see [Performance](performance.md)).

A roadmap idea should move into shipped documentation only after its code, settings, permission behavior, privacy impact, platform support, tests or manual verification, and asset/dependency licensing are available in the repository. Preserve local user data and provider keys during changes. State platform limits and provider costs/quotas directly.

Named upstream feature adaptations must also follow the [adaptation rules](adaptation.md): preserve the selected feature's backend/operating semantics and prove parity through Yami's existing design language. The [Coucou, Terax and CodeNotch review](research/adaptation-review.md) records pinned sources, the proposed scope, and the Windows checks that remain open.

## Not a parity promise

Yami is a reconstruction from supplied references. Exact original prompts, hidden screens, private provider configuration, cosmetic unlock rules, and animation timing are not known. Future work will improve Yami as an open-source Windows app; it cannot certify that unknown original behavior has been recreated.
