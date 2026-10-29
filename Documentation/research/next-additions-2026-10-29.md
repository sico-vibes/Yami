# Next additions (2026-10-29)

The owner asked what else would make Yami the all-in-one desktop and personal companion, which free APIs it can use, and which tools it can render in its own interface while staying light. This note is a proposal, not shipped behaviour. Everything here follows the existing rules: optional modules, nothing running while idle, native-feeling Yami UI (no sending people to another app), free first, and the 100–200 MB idle budget.

What Yami already has is listed in [Features and settings](../features-and-settings.md). That includes Tune (tweaks, startup, DNS, network shield, admin, cleanup, disk space, installed apps, mouse pointer), the file wheel, the terminal and agents, feeds, mail and Bluesky, the browser and vault, remote, media, and dictation. The ideas below fill the gaps between Yami and the tool suites people install next to it.

## How the ideas were chosen

- **Borrow behaviour, not code.** PowerToys is MIT, but it is C#/C++ and WinUI. Yami borrows what a utility does and builds it with its own native host (`native/*.cs`), its own pages and its own tokens.
- **Zero cost when off.** Each idea names what runs while idle; most need nothing.
- **Free APIs only when they are keyless or bring-your-own-key, and only on request.** Terms below were read from search results and provider pages on 2026-10-29. Each is marked **verify** where the provider's own terms page was not read.

## Tier 1: everyday utilities (borrowed from PowerToys, built natively)

The current PowerToys README names 31 utilities. These are the ones Yami does not cover yet, ranked by daily use per idle cost:

| Idea | What it does in Yami | How | Idle cost |
| --- | --- | --- | --- |
| **Keep awake** (Awake) | An island toggle and timer that stops sleep (indefinitely, for 30 min, 1 h, 2 h, or until a time) | `SetThreadExecutionState` in the native host; ends when Yami quits | None beyond a flag |
| **Color picker** | Hotkey, then a magnifier that follows the pointer; click copies HEX/RGB/HSL and keeps a history in Yami | Native host: `GetPixel` on a screen capture, small overlay window only while picking | None until used |
| **Text extractor** (OCR anywhere) | Draw a box over any part of the screen and get its text, copied and shown in Yami | The lasso already exists; Windows OCR (`Windows.Media.Ocr`) is already in `native/Ocr.ps1` | None |
| **Always on top** | Pin the focused window above others with a hotkey; a thin lavender frame shows it | `SetWindowPos(HWND_TOPMOST)` in the native host; the frame is one transparent window only while pinned | One small window while a window is pinned |
| **Window layouts** (FancyZones, lite) | **Built 2026-10-29:** halves, quarters, thirds, centre and maximise from the Controls card and the launcher. Still open: hotkeys and saved per-monitor layouts | `MoveWindow` already in the host; layouts are JSON | None |
| **Quick accent** | **Built 2026-10-29:** hold a letter, press Space, pick é, ü, ñ from a small strip (off by default) | Low-level keyboard hook already in the host | Hook already present |
| **Hosts file editor** | **Built 2026-10-29:** list, switch off, add and remove hosts entries, with an exact Put back | One elevated write through the existing admin helper pattern | None |
| **Environment variables** | **Built 2026-10-29:** view and edit your user variables, Path as a folder list, exact Put back. System variables (admin) are still open | HKCU `Environment` through `reg.exe`, then a `WM_SETTINGCHANGE` broadcast | None |
| **Screen ruler** | Measure pixels between edges on screen | Overlay window while active | None |
| **Image resizer** | Already covered by the file wheel's resize petal | n/a | n/a |
| **Peek** (quick look) | Space on a selected Explorer file opens Yami's viewer (images, PDF, text, media) | Explorer selection is already read for the wheel; viewers exist in the tool window | None |
| **PowerRename** | Batch rename with find/replace, regex and preview | The wheel already has batch rename; add regex and preview | None |
| **Workspaces** | **Built 2026-10-29:** save the open apps and their window positions, then restore them with one click | Window list and `MoveWindow` exist; launching apps exists | None |

**Recommended first three:** Keep awake, Color picker and Always on top. They are small, they are used daily, and they reuse code Yami already has. **Keep awake, Color picker and Always on top are built** (Controls card, 2026-10-29).

## Tier 2: free data, shown as Yami cards and palette answers

Each one is fetched only when a card opens or the palette is asked, and cached.

| API | Use in Yami | Terms found | Notes |
| --- | --- | --- | --- |
| **Frankfurter** (`api.frankfurter.dev`) | **Built 2026-10-29:** `100 usd to eur` in the launcher (v2 `rate` endpoint) | No key; ECB daily rates, updated about 16:00 CET; v1 frozen, v2 recommended ([frankfurter.dev](https://frankfurter.dev/v1)) | Not real-time; say "rates from <date>" |
| **Nager.Date** (`date.nager.at/api/v3`) | **Built 2026-10-29:** public holidays in Today's week strip and agenda. Still open: Plans and the "next long weekend" | No key; 100+ countries; no documented rate limit (**verify** terms) | One request per year and country, cached |
| **Open-Meteo Air Quality** (`air-quality-api.open-meteo.com`) | **Built 2026-10-29:** UV index and US AQI in the weather card. Pollen is still open | No key for non-commercial use, fair use, data under CC BY 4.0 (attribution needed) | Yami's forecast stays on MET Norway; pollen covers mostly Europe |
| **Radio Browser** (`api.radio-browser.info`) | **Built 2026-10-29:** a Radio tab in the island drawer: search, play in Yami, keep favourites | No key; community-maintained station list; server software AGPL-3.0, used as a service, not bundled (**verify** terms) | Streams are played by Yami's own audio element |
| **iTunes Search** (`itunes.apple.com/search`) | **Built 2026-10-29:** find podcasts by name, then follow their RSS feed in the Inbox | No key; about 20 requests per minute per IP | Episodes come from the public RSS feed, which Feeds already reads |
| **Wikipedia** (already used) | `define <word>` and "what is" summaries in the palette | Already in use | Add Wiktionary definitions |
| **REST Countries, World time** | Time-zone and country facts in the palette ("time in Tokyo") | No key | Windows' own time-zone data can answer most of it offline, which is better |
| **USGS earthquakes, NASA APOD** | Optional Today cards | USGS no key; NASA works with `DEMO_KEY` (low limits) or a free key | Fun, low priority |
| **OSV.dev** (`api.osv.dev`) | **Built 2026-10-29:** Check packages on AI workspace project cards (npm lockfiles) | No key | Fits the Dev hub's project cards |

## Tier 3: companion and AI

- **Local AI on Windows.** Microsoft's Windows AI APIs (Phi Silica, text recognition, image description) target Copilot+ PCs. Microsoft's transparency note says Phi Silica now also runs on supported non-Copilot+ PCs through the GPU, and press reports describe that path as experimental and limited to certain recent GPUs. Some APIs are limited-access. Yami could use them when they are present and fall back to Whistle and the local-model chat it already has. **Verify** availability on this PC before building anything.
- **Daily brief** (built 2026-10-29 on Home, from saved plans, holidays, mail and feeds; the Gemini summary and agent results are still open). Combine today's plans, holidays, weather and air, unread mail, the Bluesky and feed headlines, and agent results into one card. Gemini summarises it only when you press Brief me.
- **Focus sessions** (built 2026-10-29: keep awake, radio and site blocking with the focus timer; Do Not Disturb is still open). The focus timer plus Keep awake, Do Not Disturb (Windows' notifications setting), a playlist or radio station, and optionally blocking distracting sites through the network shield's own rules for the session.
- **Clipboard actions** (Advanced Paste). Paste as plain text, as Markdown, or as JSON, and translate or summarise with Gemini on request, from the existing clipboard history.
- **Mood and reactions.** The expansion plan's companion phase: the spirit reacts to finished agents, a long focus session, or low battery, briefly, and respects reduced motion.

## Tier 4: bigger pieces, later

- **Everything-class file search.** Yami uses the Windows Search index today. An NTFS USN-journal index (what Everything does) would be faster, but it needs administrator rights for the volume handle and a resident index (tens of MB). Measure before building.
- **Mouse without borders and multi-PC.** Yami Remote already covers phone control. PC-to-PC is a large networking feature; leave it out unless asked.
- **Rainmeter-style widgets.** The desk widget exists. More widget kinds (CPU graph, calendar, radio) can reuse its one window rather than adding windows.

## Open verification gaps

- Radio Browser and Nager.Date official terms pages; Open-Meteo attribution wording in the UI.
- Windows AI API availability and access requirements on this PC.
- Whether PowerToys-style hotkeys (color picker, always on top, quick accent) collide with Yami's existing shortcuts; every new hotkey must be optional and empty by default where conflicts are likely.

## Sources

- PowerToys README, utility list (v0.103 roadmap): https://github.com/microsoft/PowerToys
- PowerToys 0.97 and 0.98 coverage: https://www.neowin.net/amp/powertoys-097-is-out-with-a-big-update-for-one-of-its-best-utilities-and-a-new-mouse-tool/ , https://www.windowscentral.com/software-apps/my-favorite-free-windows-11-app-just-got-another-great-update-whats-new-in-powertoys-v0-98
- Frankfurter v1 documentation: https://frankfurter.dev/v1
- Nager.Date API: https://date.nager.at/de/Api
- Open-Meteo air quality (secondary summaries): https://rdrr.io/cran/openmeteo/man/air_quality.html
- Radio Browser (secondary listings): https://github.com/ivandotv/radio-browser-api , https://apis.io/providers/radio-browser/
- iTunes Search API documentation: https://performance-partners.apple.com/resources/documentation/itunes-store-web-service-search-api/
- Free keyless API roundup (2026): https://dev.to/0012303/150-free-apis-you-can-use-without-an-api-key-2026-edition-28mn
- Windows utility roundups: https://www.windowsmode.com/best-windows-software/ , https://hassanali-portfolio.pages.dev/blog/best-windows-power-tools-in-2026-free-fast-and-actually-worth-using
- Raycast and Flow Launcher on Windows: https://zenn.dev/yahat/articles/c928bf7a5d1fff?locale=en , https://alternativeto.net/news/2025/11/raycast-for-windows-launches-public-beta-with-native-search-and-extension-support/
- Phi Silica transparency note: https://learn.microsoft.com/en-us/Windows/ai/apis/phi-silica-transparency-note
