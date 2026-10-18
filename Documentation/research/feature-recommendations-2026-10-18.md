# Feature recommendations and reference scan (2026-10-18)

Status: **proposed, not shipped.** This note records a research pass, a code review of Yami as it stands on `main`, and a ranked list of ideas. Nothing here is a commitment. Each item needs its own design, permission review, privacy review, measurement, and documentation update before it becomes a feature. Items marked *verify* depend on Windows APIs that have not been checked on a Windows machine.

Read this note together with the [product brief](../reference/product-brief.md), the [roadmap](../roadmap.md), the [adaptation rules](../adaptation.md), and the [performance budgets](../performance.md). Where this note and those pages disagree, the product brief and the performance budgets win.

## 1. Direction

Yami is meant to be a lightweight Windows utility with a soul. It should give Windows a friendly, characterful layer and make the desktop more capable and more personal. The owner's stated goals, recorded here so a future agent starts from the same place:

- **Lightweight is a product requirement.** Users should not see high GPU, CPU, or RAM use caused by Yami. Idle behaviour matters most. Targets are in [performance](../performance.md).
- **More utilities and more Windows customization than today,** collected in one place. Windows already has many scattered settings. Yami should bring them together and make them quick to reach.
- **Fun and theming.** The spirit should feel alive, and the whole Windows look should be themeable from Yami.
- **Smart search in the spirit of Raycast,** kept light.
- **Borrow ideas from the Linux customization world** (Omarchy and related shells) where they fit Windows.
- **Hitodama is the inspiration, not the template.** Yami keeps its own name, character, artwork, and copy.

## 2. What the references show

### Hitodama (inspiration, paid)
Source: [hitodama.in](https://hitodama.in/) (checked 2026-10-18).

- A paid Windows voice assistant (one-time Founders Edition purchase). It runs on the user's own Gemini key.
- Features: Circle to Ask (Ctrl+Shift), dictation (Ctrl+Win) with correction cleanup, scheduled tasks, routines, voice site search, a to-do list, a desktop island (music, settings, plans, clipboard, apps, wallpapers), and loadout slots for Soul, Personality, Voice, and Abilities.
- Yami already covers almost all of this, and it is free.
- Hitodama's public page does not show skins packs, a utilities suite, theming, or cursor control. That is the open space for Yami.

### omacale (skin and shell inspiration)
Source: [AyushKr2003/omacale](https://github.com/AyushKr2003/omacale) (GPL-3.0; checked 2026-10-18).

- A Caelestia-style shell for Omarchy (Linux, Hyprland), shipped as one bar plugin.
- Useful ideas: Material colours generated from one source colour, drawers for a dashboard, launcher, utilities, session menu, and settings, a volume and brightness OSD, a launcher with calculator, clipboard history, and wallpaper and theme pickers, `h j k l` keyboard navigation, and live-applied settings.
- Its optional glass and liquid effects cost GPU. If Yami ever adopts a similar look, keep those effects off by default.
- Licence: GPL-3.0. Use as an idea source only. Do not copy code, shaders, or artwork.

### omarchy-dynamic-island (activity model)
Source: [Arjun010011/omarchy-dynamic-island](https://github.com/Arjun010011/omarchy-dynamic-island) (MIT; README read 2026-10-18). The plugin catalogue page [plugins.omarchy.org](https://plugins.omarchy.org/plugin.html?id=omarchy-dynamic-island) reported "Plugin not found" on the same date.

- An Apple-style Dynamic Island in Omarchy's shell. It runs inside the existing shell and re-colours with the theme.
- Features: a resting ticker, media with cover art and an equalizer, a REC indicator, microphone and camera dots, timers and a stopwatch that survive restarts, calendar countdowns from iCalendar feeds, Bluetooth announcements, charging and low-battery messages, volume and brightness bars, audio-output switching, script-driven activities with progress rings and a TTL, a notification banner with actions, a persistent inbox, Do Not Disturb, and an OSD replacement.
- Its design choices to avoid: continuous animation while activities are active (the equalizer, pulsing dot, edge light, and album wash), an idle ticker that keeps cycling, and calendar feeds re-read every 15 minutes. These conflict with Yami's idle rules.
- The project is young (14 stars, 22 commits, as of the fetch). Its code is Linux-only, so only the concepts apply.

### Raycast (search and launcher)
Sources: [Raycast vs Alfred](https://www.raycast.com/raycast-vs-alfred), [Toolradar review](https://toolradar.com/tools/raycast/reviews), [The Sweet Setup](https://thesweetsetup.com/?p=162473), [Asian Efficiency](https://www.asianefficiency.com/productivity/raycast-mac-productivity-hub/) (checked 2026-10-18; the sources disagree on the free tier, so re-check before relying on any pricing).

- Launcher with app launch, window management, clipboard history (retention depends on plan), snippets that expand on a keyword, quicklinks, a calculator, extensions from a store, and AI commands.
- Yami already has an app, file, and snippet launcher, clipboard history, and window tools (list, focus, move). It lacks the keyboard-first action panel, quicklinks, a calculator, and a window-switch UI.

### Omarchy (Linux distribution)
Sources: [omarchy-waybar-config](https://github.com/gupta-akshay/omarchy-waybar-config) (example of the community theme ecosystem). Omarchy is an Arch Linux distribution on Hyprland with a single theme that drives most apps and a `refresh` command that resets a config to its defaults.

- Idea for Yami: one theme file or bundle that sets wallpaper, accent, light or dark mode, skin, cursor, sounds, and terminal colours. Also a per-area "reset to defaults".

### Windows cursor customization
Source: [CursorFX on WinCustomize](https://www.wincustomize.com/article/308547) (commercial; checked 2026-10-18). Stock Windows only exposes schemes and per-cursor file selection. CursorFX adds animated themes, size, shadows, and trails.

### PowerToys (Microsoft, MIT)
Source: [microsoft/PowerToys](https://github.com/microsoft/PowerToys). Recalled from its public feature set, not re-read for this note: Awake (keep-awake), FancyZones (window zones), Keyboard Manager, Color Picker, Text Extractor, Mouse Highlight, and Always on Top. *Verify* each against the current project before relying on it.

## 3. What Yami has today (code review, 2026-10-18)

Confirmed in the code:

- **Present:** island with an action card, roaming Yami, focus timer, media peek, now-playing card, wallpapers (folder browse and apply), volume, brightness, theme, Wi-Fi, Bluetooth, Night Light, system stats, speed test, power actions, to-dos, memories, plans and routines, clipboard history, the app, file, and snippet launcher, the AI workspace (sessions, usage, connectors, local model, MCP, terminal, notes, dictation, recaps), and the file wheel.
- **Missing:** wallpaper rotation; accent colour, transparency, taskbar, desktop icon, and hidden-file controls; keep-awake; snippet expansion as you type; a window-switch UI (window tools exist only as Gemini tools); per-app audio and output-device switching (master volume only); a notification inbox; calendar countdowns; scriptable activities; a settings profile import.
- **Limitations worth fixing:** `indexFiles` walks the Desktop, Documents, and Downloads folders up to five levels deep, capped at 20,000 entries. Windows Search already indexes these areas, so a query against that index would be cheaper. The file wheel's OCR is not connected, but Windows has a built-in OCR API that needs no download (*verify*).

## 4. Ranked recommendations

Weight: **Low** means event-driven or on demand, with no idle cost. **Medium** means a bounded background piece. **High** means continuous work, so it needs a strong case and an off switch.

### Tier 1: start here

| # | Idea | What it does | Inspired by | Weight | Windows basis (*verify*) |
| --- | --- | --- | --- | --- | --- |
| 1 | Theme Hub | One place to apply a bundle: wallpaper, accent, light or dark mode, skin, cursor scheme, sounds, terminal colours. Per-area reset. | Omarchy, omacale | Low | Registry values and `SystemParametersInfo`; existing wallpaper and theme code |
| 2 | Cursor manager | Preview, install, apply, and resize cursor schemes. Trails and shadows opt-in only. | CursorFX, Windows Mouse settings | Low (trails: Medium) | `HKCU\Control Panel\Cursors`, `SystemParametersInfo` with `SPI_SETCURSORS` |
| 3 | Launcher on the Windows Search index | Replace the folder walk with a query against the index. Faster, covers the whole profile. | Raycast | Low | Windows Search index |
| 4 | Keep-awake | Toggle that prevents sleep for a set time. Zero cost when off. | PowerToys Awake | Low | `SetThreadExecutionState` |
| 5 | OSD in the island | Volume, brightness, and mic-mute changes show as slim bars in the island. | omacale, omarchy-dynamic-island | Low | Existing volume and brightness events |
| 6 | Window switcher and snap zones | Searchable window switcher; hotkeys place a window into a preset zone. | Raycast, FancyZones | Low | Window enumeration and `SetWindowPos` |
| 7 | Scheduled light and dark mode, wallpaper rotation | Sunrise and sunset switching; rotate wallpapers from a folder, optional per-monitor. | Omarchy | Low (one timer) | Registry personalize keys; existing wallpaper code |

### Tier 2: next

| # | Idea | What it does | Inspired by | Weight | Windows basis (*verify*) |
| --- | --- | --- | --- | --- | --- |
| 8 | Command palette upgrade | Fuzzy search across apps, settings, Yami actions, files, snippets; actions panel; keyboard-only. | Raycast | Low | Existing launcher |
| 9 | Quicklinks and custom search engines | Templated URLs with arguments. | Raycast | Low | Existing URL and search code |
| 10 | Built-in tools in the launcher | Calculator, unit conversion, colour picker, password and UUID generator, QR generator. Currency needs opt-in network. | Raycast, omacale | Low | Local |
| 11 | Built-in OCR | Connect the file wheel's OCR and offer "copy text from screen". | PowerToys Text Extractor | Low | Windows OCR API, no download |
| 12 | Shortcut manager | UI to rebind global and per-app hotkeys, with conflict checks. | Omarchy keybinds | Low | Existing hotkey code |
| 13 | Audio mixer | Per-app volume and output-device switching. Start with the existing endpoint code. | omarchy-dynamic-island | Medium | Core Audio sessions; device switching is undocumented, so *verify* |
| 14 | Activity bus on the island | One shared model for timers, recording, mic or camera use, meeting countdown, Bluetooth, charging, and tool activity. A second activity gets its own bubble. | omarchy-dynamic-island | Low | Event-driven sources only |
| 15 | Mic and camera privacy dots | Show when the microphone or camera is in use. | omarchy-dynamic-island | Low if event-driven | `CapabilityAccessManager\ConsentStore`; *verify* whether it can be watched without polling |
| 16 | Accent sync | Read the Windows accent colour and react to changes, so Yami's colours follow it. | omarchy-dynamic-island | Low | Registry change notification, not polling |
| 17 | Multiple timers, alarms, stopwatch | Several timers, a stopwatch that survives restarts. | omarchy-dynamic-island, Hitodama | Low | Existing focus timer |
| 18 | Focus scenes | One hotkey runs a routine: Do Not Disturb, hide taskbar, start the focus timer. | Hitodama routines, Omarchy | Low | Existing routines engine |
| 19 | Mood from system state | The spirit reacts to low battery, a CPU spike, music, a running timer, or a meeting. Uses signals Yami already reads. | Original | Low | Existing metrics, media, and timer state |
| 20 | Settings profiles | Export and import profiles without keys, and reset any settings group to defaults. | Omarchy `refresh` | Low | Existing export |

### Tier 3: later, after a permissions model

| # | Idea | What it does | Inspired by | Weight | Notes |
| --- | --- | --- | --- | --- | --- |
| 21 | Notification inbox | Mirror Windows notifications into a small inbox with actions and Do Not Disturb. | omarchy-dynamic-island | Medium | Needs `UserNotificationListener` permission. Strong privacy weight; keep off by default. |
| 22 | Calendar countdown | "Meeting in 15 minutes" from a user-supplied iCalendar link. | omarchy-dynamic-island | Low (opt-in) | Feed reads on an interval, so manual refresh by default. No account login. |
| 23 | Scriptable activities | Routines and scripts post activities to the island through a small permissioned JSON-line protocol. | omarchy-dynamic-island | Medium | Needs a sandbox and a clear permission prompt. |
| 24 | Skin packs | Skins as declarative JSON or image files, with no code. | omacale, Omarchy | Low | Extends the loadout. |
| 25 | Terminal colour import | Import Windows Terminal colour schemes into the Yami terminal. | Terminal workbench | Low | Existing terminal theme code. |
| 26 | Third-party widgets | A widget host, like omacale's plugin host. | omacale | High | Defer until the permission and capability model is designed. |

### Tier 4: explore

- Local speech model loaded only for an explicit session (see the roadmap's "Explore" row).
- Display profiles (resolution, scale, arrangement) through the display configuration API (*verify*).
- Yami reacts to meetings and screen sharing so it can stay quiet.

## 5. What to avoid

- **Continuous animation while idle.** The equalizer, pulsing dot, edge light, and album wash in omarchy-dynamic-island run whenever their state is active, with no benchmark. Animate only on a change, cap the frame rate, and keep idle still.
- **Cycling idle tickers.** A resting pill that changes every few seconds breaks the idle rule. Use a static idle face.
- **Glass and liquid effects on by default.** They cost GPU.
- **Timers that re-read feeds or re-scan folders.** Prefer event-driven sources, a cached index, or a manual refresh.
- **Copying GPL or closed-source code.** omacale is GPL-3.0. Raycast is closed source. Use ideas only.

## 6. Guardrails for every item

1. Event-driven first: registry change notifications, window events, and the existing native host, not polling loops.
2. Off by default for anything that uses the network, the microphone, the camera, or the screen.
3. Each feature has a settings toggle and an off state that costs nothing.
4. Measure idle cost on a packaged build before release, using the process-tree method in [performance](../performance.md).
5. System changes go through a preview and a reversible apply, as Hook changes already do.
6. Follow the [adaptation rules](../adaptation.md) for any upstream feature, and record the source revision and licence.
7. Keep the Yami character and copy original.

## 7. Verification gaps

- The Omarchy plugin catalogue page did not resolve on 2026-10-18. The GitHub README was read directly.
- Raycast and PowerToys features come from their public descriptions and general knowledge. Their source was not read.
- Every Windows API named above (registry cursor values, `SystemParametersInfo`, `SetThreadExecutionState`, Windows OCR, the Windows Search index, `CapabilityAccessManager`, `UserNotificationListener`, display configuration) is unverified on this machine.
- Pricing for Raycast's AI and clipboard tiers conflicted across sources and must be checked against the official pricing page.

## 8. Suggested next steps for a future agent

1. Decide which Tier 1 items to build first, with the owner.
2. For each chosen item, write a short design note and list its permissions, data flow, and idle cost.
3. Prototype the Windows calls in the native host and check them on a Windows machine.
4. Build the Theme Hub and cursor manager first, since they share the most plumbing with the existing theme and wallpaper code.
5. Measure the packaged idle footprint before and after each change, and record the results in [performance](../performance.md).
6. Update the [features page](../features-and-settings.md), the [roadmap](../roadmap.md), and this note when an item ships or is dropped.
