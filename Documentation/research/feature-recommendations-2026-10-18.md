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

### end4-pC and illogical-impulse (desk shell, dock, widgets)
Sources: [end4-pC](https://github.com/pctrade/end4-pC), [its GitHub API record](https://api.github.com/repos/pctrade/end4-pC), and [illogical-impulse (dots-hyprland)](https://github.com/end-4/dots-hyprland), checked 2026-10-18.

- end4-pC is a personal config fork of illogical-impulse. It is a Quickshell (QML) shell for Hyprland on Linux, and it needs illogical-impulse installed and running. It keeps its own config folder and launches with `qs -c end4-pC`.
- Described features: a configurable bar; a `SUPER` launcher where typing `<` lists keybinds and typing terms such as "wallpaper" or "bar" jumps to Settings pages; a Settings overlay; a preset dashboard that downloads, installs, uploads, and removes community presets; desktop widgets, including a weather widget credited to @gh0stzk; online wallpapers; shader transitions; Material 3 styling; lyrics; translations.
- Upstream illogical-impulse adds an overview that shows open apps with live previews, a status bar and sidebars, AI providers (Gemini, Ollama), screen translation, anti-flashbang, and Google Lens integration. It aims for keybinds familiar to Windows users.
- Preset model: presets are shell configurations shared through a gallery, with automated checks and manual review for first-time authors.
- Licence: the GitHub API reports GPL-3.0 for end4-pC. One README read said no licence was stated, so check the LICENSE file. Upstream is GPL-3.0. Yami is MIT, so use the ideas only.
- Resource use: neither project states RAM or CPU figures, and no measurement was found. Both are Linux-only, so their cost could not be measured here.

### Flairy: Custom Folder Icons (folder icons, macOS)
Source: [Flairy on the Mac App Store](https://apps.apple.com/us/app/flairy-custom-folder-icons/id6785116899?mt=12), checked 2026-10-18.

- A free Mac app (macOS 15 or later, 90.7 MB) that replaces folder icons with designs showing what a folder holds.
- Over 50 built-in icons across categories. Version 1.1 adds PNG and JPEG uploads, batch apply to many folders, and replacing an existing icon. It works on folders that already have a colour, emoji, or symbol.
- Not mentioned: SF Symbols, colour presets, and emoji as an icon source. Reviewers asked for SVG import and categories for programming and photo editing.
- The developer reports no data collection. Apple has not verified this.

### Windows platform notes for a bar, dock, widgets, and skins
- **App bar.** A third-party window can reserve a screen edge with the app bar messages (`ABM_NEW`, `ABM_QUERYPOS`, `ABM_SETPOS`). The shell sends `ABN_FULLSCREENAPP` when a full-screen app opens. The docs say the messages account only for the system taskbar, so other toolbars need checking. Sources: [SHAppBarMessage](https://learn.microsoft.com/en-us/windows/desktop/api/Shellapi/nf-shellapi-shappbarmessage), [Shell messages](https://learn.microsoft.com/en-gb/windows/win32/shell/messages). *Verify* with an Electron window.
- **Windows Widgets board.** Third-party widgets are reported to use Adaptive Cards rather than HTML, to be packaged as a Windows app (MSIX), and to be distributed through the Store. Sources: [GHacks](https://www.ghacks.net/?p=181162), [BetaNews](https://betanews.com/2022/10/06/windows-11-build-25217-third-party-widgets/). These are from the preview period, so check current Microsoft Learn requirements before relying on them.
- **Rainmeter (skins).** Described as light, but no benchmarks were found. Skins can run Lua scripts, so any skin system needs a security model. Source: [Windows Mode](https://www.windowsmode.com/?p=45807).
- **Folder icons.** See section 4.2.

## 3. What Yami has today (code review, 2026-10-18)

Confirmed in the code:

- **Present:** island with an action card, roaming Yami, focus timer, media peek, now-playing card, wallpapers (folder browse and apply), volume, brightness, theme, Wi-Fi, Bluetooth, Night Light, system stats, speed test, power actions, to-dos, memories, plans and routines, clipboard history, the app, file, and snippet launcher, the AI workspace (sessions, usage, connectors, local model, MCP, terminal, notes, dictation, recaps), and the file wheel.
- **Missing:** wallpaper rotation; accent colour, transparency, taskbar, desktop icon, and hidden-file controls; keep-awake; snippet expansion as you type; a window-switch UI (window tools exist only as Gemini tools); per-app audio and output-device switching (master volume only); a notification inbox; calendar countdowns; scriptable activities; a settings profile import.
- **Limitations worth fixing:** `indexFiles` walks the Desktop, Documents, and Downloads folders up to five levels deep, capped at 20,000 entries. Windows Search already indexes these areas, so a query against that index would be cheaper. The file wheel's OCR is not connected, but Windows has a built-in OCR API that needs no download (*verify*).

## 4. Feasibility studies

### 4.1 Desk surface, dock, and widgets

Question: can Yami do end4-pC-style bar, dock, and widgets while staying light?

**Verdict: partly.** The cheap pieces fit Yami's design. A full always-on shell does not, because each Yami window is an Electron renderer.

Baseline, from the [performance page](../performance.md) (packaged build, 2026-10-17): idle private working set 165.8–165.9 MB across eight processes, against a 50–100 MB target that is not met. Roaming adds one renderer. In the 0.2.0 comparison, roaming off measured 174–221 MB and on measured 188–200 MB. That spread overlaps, so one extra small renderer costs roughly tens of megabytes. That is not a measured widget cost.

| end4-pC or upstream feature | Yami cost | Verdict |
| --- | --- | --- |
| In-window dock | None extra; the bottom navigation already exists | Keep |
| Bar at a screen edge | One window that reserves the edge (app bar) | Optional |
| Launcher with settings search and keybind list | None extra; the launcher exists | Do |
| Desktop widgets (clock, weather, media) | One desk-surface window and one renderer; updates once a minute or on events | Do, as one window |
| Each widget as its own window | One renderer per widget | Avoid |
| Overview with live previews | DWM thumbnails, GPU use, only while open | On demand |
| On-screen display | None extra; the island | Do |
| Shader transitions, glass and liquid effects | GPU use | Off by default, or skip |
| Lyrics, online wallpapers, translation, Lens-style search | Network use and privacy | Opt-in only; no Lens-style upload by default |
| Lock screen | Not possible; Windows secure desktop | Not feasible |
| Preset gallery | Low; declarative data only | Later, with review |

Architecture options:

1. **One desk-surface window (recommended now).** All widgets live in one transparent, click-through window with one renderer, and update only while visible.
2. **Windows Widgets board.** Native rendering keeps Yami's own cost low, but it means Adaptive Cards only, MSIX packaging, and Store distribution. That is a large change.
3. **Native shell** (Win32, WinUI, or the .NET code the host already uses). Lowest memory, but a large rewrite. The roadmap already lists it as an option.
4. **Rainmeter-style skin engine.** Avoid script-capable skins.

Recommended path:

1. Fix the floor first: measure the packaged idle, then cut avoidable windows and processes.
2. Add the cheap items: launcher settings search, keybind list, island on-screen display, and the Theme Hub.
3. Build one desk-surface window with clock, weather, and media. Measure with and without it.
4. Add an optional app bar dock as one window, and test it against full-screen apps.
5. Decide on a native shell with numbers from steps 1 and 3.

Answer to the question: not as an always-on shell today. Yes for the dock, launcher, on-screen display, and one desk surface with widgets, once the floor is lower.

### 4.2 Folder icon customization

Question: can Yami offer Flairy-style folder icons from the file wheel, opened by a modifier during a folder drag?

**Verdict: yes, at moderate effort, with no idle cost.** Holding a folder and tapping a modifier uses the file wheel's existing gesture. Holding the key still does not open the wheel, so Windows' own drag keys keep working.

What Yami needs:

- **Folders in the wheel.** The wheel rejects folders today. `describeWheelFiles` in `electron/wheel/paths.ts` throws "Choose a file, not a folder." A folder kind must be added to that check and to `src/wheel/catalog.ts`.
- **Folder petals.** "Change icon" and "Reset icon", alongside the existing path and terminal actions. Put them on the Tools wheel (Ctrl), or in a folder mode.
- **An icon picker window** with bundled icons, emoji, and uploads.
- **An ICO writer.** ICO files can hold PNG data, so no conversion tool is needed. Emoji and uploads are drawn in the renderer and wrapped as ICO.
- **Apply.** Copy the ICO into `%APPDATA%\Yami\folder-icons`. Merge `desktop.ini` with `[.ShellClassInfo] IconResource=path,index`, keeping other keys and backing up the previous file. Set the folder's Read-only attribute, set `desktop.ini` to Hidden and System, and refresh the shell's icon cache with `SHChangeNotify`.
- **Reset.** Remove only the `IconResource` line Yami wrote, and restore only the attributes Yami set.
- **Batch.** Apply to several selected folders with one Undo record.

Safety: refuse drive roots, `C:\Windows`, Program Files, and the user profile root. Work only on the dragged folder. Preview before writing, and keep Undo. The change is local and reversible, so it does not need the sensitive-action dialog.

Windows risks to verify:

- A [community forum report](https://groups.google.com/g/sandplemacmis/c/tUeCRk7kCVM) says a custom icon reset after a reboot. Test persistence before shipping.
- Explorer caches icons, and the exact `SHChangeNotify` flags are unverified.
- OneDrive, Dropbox, Git, and other tools use `desktop.ini`. Preserve their keys.
- Some folders need admin rights to write `desktop.ini`. Show a clear message.
- Icons live under `%APPDATA%`, so moving app data breaks them.

Reference points, both older or community-sourced: [Microsoft's archived "Customizing Icons"](https://msdn2.microsoft.com/en-us/library/bb776856(v=vs.85)) and [WinHelpOnline](https://www.winhelponline.com/blog/shell-folders-are-displayed-with-the-standard-folder-icon-in-windows/).

Licence: bundled icons must be Yami-authored or permissively licensed. Do not copy Flairy's artwork.

Phasing: start with bundled icons, emoji, and single-folder apply with Undo. Add uploads and batch next, and SVG import later.

## 5. Ranked recommendations

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
| 27 | Folder icon customization | Change, reset, and batch-apply folder icons from the file wheel: bundled icons, emoji, uploads, with Undo. | Flairy | Low | `desktop.ini` `IconResource`, folder attributes, `SHChangeNotify`; needs a folder kind in the wheel. Section 4.2 |
| 28 | Settings search and keybind list in the launcher | Typing a settings name jumps to its page; `<` lists shortcuts. | end4-pC | Low | Existing launcher and settings |
| 29 | Desk surface (one window) | One transparent, click-through window with clock, weather, and media widgets. Updates once a minute or on events, hidden in full-screen. | end4-pC, illogical-impulse | Low to medium | One Electron window; measure before release. Section 4.1 |
| 30 | Optional app bar dock | A dock or bar that reserves a screen edge and steps aside in full-screen. | end4-pC, illogical-impulse | Medium | App bar messages; *verify* with Electron. Section 4.1 |

### Tier 3: later, after a permissions model

| # | Idea | What it does | Inspired by | Weight | Notes |
| --- | --- | --- | --- | --- | --- |
| 21 | Notification inbox | Mirror Windows notifications into a small inbox with actions and Do Not Disturb. | omarchy-dynamic-island | Medium | Needs `UserNotificationListener` permission. Strong privacy weight; keep off by default. |
| 22 | Calendar countdown | "Meeting in 15 minutes" from a user-supplied iCalendar link. | omarchy-dynamic-island | Low (opt-in) | Feed reads on an interval, so manual refresh by default. No account login. |
| 23 | Scriptable activities | Routines and scripts post activities to the island through a small permissioned JSON-line protocol. | omarchy-dynamic-island | Medium | Needs a sandbox and a clear permission prompt. |
| 24 | Skin packs | Skins as declarative JSON or image files, with no code. | omacale, Omarchy | Low | Extends the loadout. |
| 25 | Terminal colour import | Import Windows Terminal colour schemes into the Yami terminal. | Terminal workbench | Low | Existing terminal theme code. |
| 26 | Third-party widgets | A widget host, like omacale's plugin host. | omacale | High | Defer until the permission and capability model is designed. |
| 31 | Window overview with live previews | Open windows as thumbnails, drawn only while the overview is open. | illogical-impulse | Medium (GPU while open) | DWM thumbnails; *verify* the cost |
| 32 | Theme pack gallery | Share and install declarative theme packs, with automated checks and manual review for new authors. | end4-pC presets | Low | Declarative data only, never scripts |
| 33 | Screen translation and Lens-style search | Translate or search on-screen text. | illogical-impulse | Medium (network) | Opt-in only; Windows OCR plus a provider; no upload by default |

### Tier 4: explore

- Local speech model loaded only for an explicit session (see the roadmap's "Explore" row).
- Display profiles (resolution, scale, arrangement) through the display configuration API (*verify*).
- Yami reacts to meetings and screen sharing so it can stay quiet.
- Native shell rewrite (Win32, WinUI, or .NET) for the bar, dock, and widgets. Decide only after the floor is measured. See section 4.1.

## 6. What to avoid

- **Continuous animation while idle.** The equalizer, pulsing dot, edge light, and album wash in omarchy-dynamic-island run whenever their state is active, with no benchmark. Animate only on a change, cap the frame rate, and keep idle still.
- **Cycling idle tickers.** A resting pill that changes every few seconds breaks the idle rule. Use a static idle face.
- **Glass and liquid effects on by default.** They cost GPU.
- **Timers that re-read feeds or re-scan folders.** Prefer event-driven sources, a cached index, or a manual refresh.
- **Copying GPL or closed-source code.** omacale, end4-pC, and illogical-impulse are GPL-3.0. Raycast is closed source. Use ideas only.
- **Desktop widgets as separate windows.** Each one is a renderer. Use one desk-surface window.
- **Script-capable skins or presets.** Rainmeter-style Lua skins and code-based shell presets can run arbitrary code. Theme packs should be declarative.
- **Lock-screen replacement.** Windows does not let apps replace the lock screen.
- **Shader transitions and glass effects by default.** They cost GPU.
- **Uploading screen content by default,** for example for Lens-style search.

## 7. Guardrails for every item

1. Event-driven first: registry change notifications, window events, and the existing native host, not polling loops.
2. Off by default for anything that uses the network, the microphone, the camera, or the screen.
3. Each feature has a settings toggle and an off state that costs nothing.
4. Measure idle cost on a packaged build before release, using the process-tree method in [performance](../performance.md).
5. System changes go through a preview and a reversible apply, as Hook changes already do.
6. Follow the [adaptation rules](../adaptation.md) for any upstream feature, and record the source revision and licence.
7. Keep the Yami character and copy original.
8. Theme and skin packs are declarative data only, with automated checks and review before they are shared.

## 8. Verification gaps

- The Omarchy plugin catalogue page did not resolve on 2026-10-18. The GitHub README was read directly.
- Raycast and PowerToys features come from their public descriptions and general knowledge. Their source was not read.
- Every Windows API named above (registry cursor values, `SystemParametersInfo`, `SetThreadExecutionState`, Windows OCR, the Windows Search index, `CapabilityAccessManager`, `UserNotificationListener`, display configuration) is unverified on this machine.
- Pricing for Raycast's AI and clipboard tiers conflicted across sources and must be checked against the official pricing page.
- The end4-pC licence conflicts: the GitHub API reports GPL-3.0, and one README read said none was stated. Check the LICENSE file.
- No benchmark was found for illogical-impulse or Quickshell. Both are Linux-only and could not be run here.
- The Windows Widgets board details come from 2022-era coverage. Check current Microsoft Learn requirements.
- App bar behaviour with an Electron window and other toolbars is unverified.
- DWM thumbnail cost is unmeasured.
- A reported reboot reset of custom folder icons is unexplained and unverified.
- No Rainmeter skin benchmarks were found.

## 9. Suggested next steps for a future agent

1. Decide which Tier 1 items to build first, with the owner.
2. For each chosen item, write a short design note and list its permissions, data flow, and idle cost.
3. Prototype the Windows calls in the native host and check them on a Windows machine.
4. Build the Theme Hub and cursor manager first, since they share the most plumbing with the existing theme and wallpaper code.
5. Measure the packaged idle footprint before and after each change, and record the results in [performance](../performance.md).
6. Update the [features page](../features-and-settings.md), the [roadmap](../roadmap.md), and this note when an item ships or is dropped.
7. For folder icons, add a folder kind to the wheel, then prototype the `desktop.ini` write and run the reboot persistence test on Windows.
8. For the desk surface, prototype one window and measure it with and without the widgets, using the packaged build.
