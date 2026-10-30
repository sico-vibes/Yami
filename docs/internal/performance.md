# Performance goals and measurement

Yami is designed to sit quietly on a Windows desktop for long periods. The app should minimize background activity while retaining the island and scheduled actions. The budgets below are goals, not measured claims about the current build.

## Budgets and current status

| State | Working set target | CPU target | Status |
| --- | ---: | --- | --- |
| Idle with island and tray, no request active | 100–200 MB private working set for the Yami process tree | Near-zero sustained CPU, with short event-driven wakeups | The latest packaged samples (153 MB by default, 166–185 MB with the dock and desk widget, 2026-10-29) fall inside this budget; they were short runs, not soak tests. Every optional module must still cost nothing while off. |
| Active feature use | Keep the Yami process tree below 600–700 MB when practical | Bound expensive polling and release temporary media/capture buffers | Ceiling target; provider, Electron renderer, and selected feature can create short-lived spikes. |

The owner raised the idle budget from 50–100 MB to 100–200 MB on 2026-10-27 so optional modules have room; the dated measurements below were recorded against the earlier 50–100 MB target and say so.

Targets refer to aggregate resident working set for the Electron main process, renderer/utility processes, and `Yami.Native.exe`. Task Manager’s per-process rows must be summed carefully and should not be compared to private bytes, commit size, or package size. Report sample conditions and use consistent Windows builds and hardware. Do not publish a resource assertion until repeatable measurements pass.

## First idle baseline (2026-10-17)

The initial production-source Electron run used 8 Yami processes on Windows build 26300 with a Ryzen 5 5600X and 31.9 GB RAM. After a 10-second settle, three snapshots five seconds apart recorded:

- **Private working set, summed across the process tree:** 165.3–167.7 MB.
- **Working set including shared pages, summed across the process tree:** 705.5–708.1 MB.
- **CPU:** 0–0.33% normalized across 12 logical processors during those snapshots.

Clipboard history, app context, and weather were off. This was a short baseline from the production-source Electron app, not the packaged portable build. The private-set sample exceeds the 50–100 MB aspiration, and the shared-inclusive sample is substantially higher. The brief CPU readings do not establish sustained idle CPU behavior. This is a baseline for optimization, not evidence that Yami is lightweight. The active-task 600–700 MB ceiling remains unmeasured; the packaged idle follow-up is recorded below.

## Packaged follow-up (2026-10-17)

The same Windows machine and fixture conditions were sampled once with the unsigned packaged app: hidden main window, collapsed island, no provider session, clipboard/context/weather off, 10-second startup settle, and three snapshots five seconds apart. Across eight current processes, private working set was **165.8–165.9 MB**, shared-inclusive working set **535.9–536.2 MB**, and sampled CPU **0%** after normalization over 12 logical processors. The shared-inclusive figure can double-count shared pages; neither it nor private working set should be confused with committed private bytes.

This is a short observation, not a task peak, a 15-minute soak, or a guaranteed idle CPU claim. The 50–100 MB idle target remains unmet. Reducing the current Electron floor may require a renderer/runtime architecture change after profiling; do not simulate savings by forcing pages out of the working set. The [measurement summary](evidence/performance-2026-10-17.json) records the procedure and samples. Run `node scripts/measure-performance.mjs --packaged` after packaging to gather a fresh local result. Use `YAMI_PACKAGE_DIR` when testing an output directory other than `release`.

## Version 0.2.0 packaged comparison (2026-10-17)

The same machine and procedure (packaged build, hidden main window, collapsed island, no provider session, clipboard/context/weather off, 10-second settle, three snapshots five seconds apart) was run once per setting:

| Setting | Processes | Private working set | Sampled CPU (of 12 logical CPUs) |
| --- | ---: | ---: | ---: |
| Roaming off | 8 | 174.4–220.7 MB | 0% |
| Roaming on (default) | 9 | 187.8–200.3 MB | 0–1.75% |
| Living flame on (with roaming) | 9 | 242.3–265.8 MB | 1.42–4.67% |

Roaming adds one renderer process, and its memory difference is within the run-to-run spread seen here. Living flame clearly costs memory and CPU because each visible Yami keeps animating at about 30 fps, so it is off by default. In the desktop check, a settled Yami requested zero animation frames over 1.5 seconds and Living flame about 49 frames over 1.5 seconds. Single short runs vary by tens of megabytes; this is not a soak test, and the 50–100 MB idle target remains unmet. The [v0.2 measurement summary](evidence/performance-2026-10-17-v0.2.json) records the samples.

## UI polish source-build check (2026-10-17)

After the idle-notch geometry and main-navigation changes, the production-source build was sampled on Windows 10.0.26300, an AMD Ryzen 5 5600X (12 logical CPUs), and 31.9 GB RAM. The main window was hidden, the island collapsed, roaming and Living flame off, no provider session, and clipboard/context/weather disabled. Following a 10-second settle, three full-process-tree snapshots five seconds apart used `Win32_PerfFormattedData_PerfProc_Process`, including the native helper.

Across eight processes, private working set was **164.6–168.2 MB**, shared-inclusive working set **732.1–735.5 MB**, and sampled normalized CPU **0–0.42%**. The earlier production-source baseline above was 165.3–167.7 MB private; these short runs are not a controlled performance comparison. The 50–100 MB idle target remains unmet. This is not a packaged measurement, task peak, or soak test; display scale and power mode were not recorded for this check. See the [sample evidence](evidence/performance-2026-10-17-ui-polish.json).

Focused Edge and Windows Electron checks also confirmed that the dock highlight and incoming-page fade have no running animations after settling, rapid navigation retargets correctly, and both the OS and Yami reduced-motion preferences suppress the new motion. The idle bar keeps the existing one-time eight-second sleep timer; its shoulder fix changes only CSS geometry.

The merged build on `main` (commit `0c850a0`, packaged as `release/Yami 0.2.1.exe`) has not been measured with the procedure below. Run `node scripts/measure-performance.mjs --packaged` before quoting figures for it.

## Optional modules and on-demand main window (2026-10-28)

Three changes landed together: each window loads only its own screen, optional modules (the AI workspace and the file wheel) are built on first use, and the main window is created only when it is shown. A hidden main window is destroyed after one minute (`electron/main-window.ts`), unless a meeting recording or an approval prompt is open; showing it again builds a fresh one and replays the events sent while its page loaded.

With **Start hidden** on, roaming on and clipboard, context and weather off, the source build measured **183.8–213.8 MB** private working set across 9 processes before the main-window change, and **161.4–163.8 MB** across 8 processes after it, at 0% sampled CPU. With roaming off it measured **140.7 MB** across 7 processes. The process counts include a `cmd.exe` and `conhost.exe` (about 9 MB) that Playwright's launcher adds on this machine. These are short runs on the [source build](evidence/performance-2026-10-28-modules.json), not a packaged measurement, task peak or soak test; they sit inside the 100–200 MB idle budget. When the main window is open it costs its renderer again (about 35–40 MB in the earlier runs).

Loading `@google/genai` and `systeminformation` on first use instead of at startup was then measured at 160.1–163.7 MB in two runs: no measurable idle change, within run-to-run spread. It is kept because it skips evaluating about 2 MB of library code at startup; startup time was not measured.

The **packaged** build (`npx electron-builder --win --dir`, then `node scripts/measure-performance.mjs --packaged`) measured **165.1–166.3 MB** private working set across 8 processes at 0% sampled CPU in two runs with roaming on, and **139.1–139.2 MB** across 7 processes with roaming off. Optional modules were at their defaults (Tune, Feeds and Offline dictation off). That is inside the 100–200 MB idle budget; it is still a short run, not a soak test, and the active-task ceiling remains unmeasured.

## After the evening's features (2026-10-28)

After folder icons, DNS over HTTPS, terminal shell integration, fan-out, the desk widget, filter lists, the RustDesk and Windhawk bridges and the mail catcher landed (each off or idle by default), `node scripts/measure-performance.mjs` on the source build measured **165.3–165.7 MB** private working set across 8 processes at 0–1% sampled CPU, the same as before them. Short run, not a packaged or soak measurement.

## After the second round of features (2026-10-29)

After terminal links, SSH hosts, layout restore and four panes, Fan out compare, the palette additions, Flatten, wallpaper rotation, browser history and login import, agent menus and uploads, the accent tweak, Whistle live captions, the media fixes and Tune's administrator section (each off or idle by default), `node scripts/measure-performance.mjs` on the source build measured **166.3 MB** private working set across 8 processes at idle, about the same as before them. Short run, not a packaged or soak measurement.

## Packaged build after the expansion (2026-10-28)

Rebuilt with `npx electron-builder --win --dir` after the day's features, then `node scripts/measure-performance.mjs --packaged`: **168.0–168.1 MB** private working set across 8 processes at idle, with roaming on and optional modules at their defaults. That is about 2 MB above the morning's packaged run and inside the 100–200 MB budget. `node scripts/verify-packaged.mjs` passed on the same build (native host, wallpaper apply and restore, metrics, DPAPI, transparent island). Short run, not a soak test.

## Packaged build after the next additions (2026-10-29)

After the network shield, Cleanup, Disk space, the mouse pointer, environment and hosts editors, Keep awake, the colour picker, always on top, window layouts, workspaces, accent characters, quick look, radio, podcasts, currency, holidays, air quality, package checks, focus sessions, the daily brief, and Outlook and Bluesky sign-in, the packaged build (`npx electron-builder --win --dir`, then `node scripts/measure-performance.mjs --packaged`, default settings, same PC) measured **165.1 MB**, and on a second run **169.3–174.6 MB**, private working set across 8 processes at idle, with 0% sampled CPU. The previous packaged figure was 168.0–168.1 MB, so the additions cost little or nothing at idle; they load when used, and the optional ones (shield, accent characters, quick look) are off by default. The run-to-run spread is about 10 MB.

## 0.3.0 beta release build (2026-10-30)

The published 0.3.0 portable build (`release/win-unpacked`, logging included, default settings with roaming on) measured **151.7–152.0 MB** private working set across 7 processes at 0% sampled CPU, with only the island and roaming Yami open. `scripts/verify-packaged.mjs` passed on the same build.

## One renderer for the small windows (2026-10-29)

Each Electron window normally starts its own renderer process, about 25–50 MB private each. The roaming Yami, the dock and the desk widget are now opened with `window.open` from the island's page, so Chromium keeps them in the island's renderer: the windows stay separate (own bounds, focus rules and IPC sender), but share one process. Opening is queued, because each opening briefly sets the island's window-open rule, and a window that cannot be hosted falls back to its own process. A side effect: if the island's renderer ends, those windows close with it and reopen on the next settings sync. The voice caption keeps its own short-lived process.

Packaged build (`npx electron-builder --win --dir`, then `node scripts/measure-performance.mjs --packaged [--dock] [--widget]`), Ryzen 5 5600X, 32 GB, Windows build 26300, default settings otherwise (roaming on):

| Scenario | Before | After |
| --- | --- | --- |
| Default (island, roaming Yami) | 168.0 MB, 8 processes | **152.6–153.0 MB, 7 processes** |
| Dock on | 217.6–222.8 MB, 9 processes | **166.1–172.3 MB, 7 processes** |
| Dock and desk widget on | not measured (≈207 MB with only the dock shared) | **180.2–184.9 MB, 7 processes** |

CPU sampled 0–1.75% at idle. All three are inside the 100–200 MB idle budget. `scripts/verify-dock.mjs` and `scripts/verify-desk-widget.mjs` now assert that their window shares the island's process.

**Measuring on a PC in use.** A test copy of Yami is a full Yami: its roaming Yami walks your real desktop and its shortcuts are live, so a click on it or a shortcut press can open its main window (about +65 MB) or change its throwaway settings. Several runs on 2026-10-29 were spoiled that way (readings of 230–300 MB with a main window open). The measurement now lists the windows that were open at the end (`windows` in `.artifacts/performance-results.json`); discard runs that show `main`.

## Whistle dictation (2026-10-28)

`needle.exe` (Needle 3, pinned) transcribing a 5-second 16 kHz WAV with `whistle.cact`: 384 ms wall time, 118 ms to the first token, peak working set about 42 MB (38 MB private), sampled every 20 ms with PowerShell. The runner exits after each utterance, so nothing stays resident. Through Yami (write WAV, run, apply Your words, paste) the whole dictation took about 1 second.

## Desk widget (2026-10-28)

The optional desk widget used to add one renderer process (see *One renderer for the small windows*, 2026-10-29: it now shares the island's). With the widget on (media playing, no agents) the desktop check read that renderer at **36–39 MB** private bytes from `app.getAppMetrics()` in four source-build runs. The whole-tree number in the same runs moved by ±15 MB with the main window and Playwright attached, so it is not a usable delta; a packaged idle measurement with the widget on has not been run. It is off by default, and switching it off closes the window.

## Browser filter lists (2026-10-28)

Parsing EasyList and EasyPrivacy (131,795 rules) inside the main process raised its private bytes from about 111 MB to 243 MB, and they stayed there 15 seconds later. A worker thread gave the same numbers, since the memory stays with the process. The build now runs in a short-lived `ELECTRON_RUN_AS_NODE` child process that writes the compact engine file and exits: the main process went 108 → 145 MB right after the build and back to 112 MB 15 seconds later. On a later start, loading the saved engine when the browser opens added 14–16 MB to the main process (114 → 128–130 MB). Source build, short runs; these figures are the Electron main process only, not the full tree.

## Network shield (2026-10-29)

Measured on the development PC with a source build and an isolated profile, reading the main process's private bytes (`process.getProcessMemoryInfo()`) 25 seconds after launch, with the StevenBlack list already downloaded: **114 MB** with the shield off and **117–119 MB** with it on (two launches each). So the listener, the 76,147 names and the HTTP/2 resolver connection cost about 4 MB. The names are one sorted file (1.6 MB) read into a buffer and searched in place; held as a JavaScript `Set`, both lists (255,438 names) took 22 MB of heap. The first download and parse is a one-time spike. With the download streamed to disk and the parse in a child process, the main process went from 100 to 123 MB in `scripts/verify-shield.mjs` and stayed there 20 seconds later. Holding the download in memory as text made it 30 MB. The weekly refresh repeats that spike. The shield has no timer when idle: it saves counts a minute after lookups, and it checks list age when a lookup arrives.

## Current sources of background work

The AI workspace starts no PTY/helper/model at idle. Monitoring, transcript
fallback, background usage and connector timers default off. When enabled,
agent events arrive over a pipe; transcript fallback uses bounded filesystem
watchers, not a rescan interval. Usage refresh is five-minute opt-in; connections
are independently opt-in at 60–3,600 seconds with deduplication/backoff. Audio
capture exists only for an explicit recording. Terminal output uses credit-based
backpressure and bounded scrollback; PCM writes use disk rather than retaining
the whole recording in renderer RAM.

On 2026-10-18 the production-source full-tree idle check measured **169.7–171.6
MB private working set**, **740.4–742.2 MB shared-inclusive working set**, and
sampled normalized CPU **0%**, across eight processes. Hardware was Windows
10.0.26300, Ryzen 5 5600X, 12 logical CPUs, 31.9 GB RAM. Settings/method matched
the previous no-roam UI-polish scenario: hidden main, collapsed island, Living
flame off, no provider, clipboard/context/weather off, ten-second settle and
three snapshots five seconds apart via Windows performance counters, including
the native helper. Display scale and power mode were not recorded. Earlier idle
baseline was 164.6–168.2 MB private; short noncontrolled runs do not establish a
regression estimate. The **50–100 MB idle target remains unmet**. This does not
measure a terminal/agent task peak or long-term recording/model ceiling. See
[evidence](evidence/performance-2026-10-18-workspace.json).

- Main process checks due tasks every five seconds. A separate Windows waitable timer asks the operating system to wake at the next scheduled action.
- Clipboard history polls every 1.8 seconds while enabled; polling skips known private contexts and pauses briefly after Yami writes text.
- Global keyboard and mouse hooks remain active while Yami is running and shortcuts are enabled. These hooks support hold-to-talk, dictation, lasso, launcher, and ability input.
- The tray and island remain active while the main window is hidden. Electron windows use `backgroundThrottling: true`. The cat spirit requests animation frames only while active and cancels its loop once settled (zero frames at idle in the browser preview). The optional **Living flame** setting deliberately keeps one animation loop per visible Yami running at idle. The roaming window, the dock and the desk widget are opened from the island's page, so they run in the island's renderer process instead of adding one each (`makeSmallWindow` in `electron/windows.ts`; if the island cannot host them they fall back to a process of their own). The roaming window hides while a fullscreen app is in front; it does not poll the cursor (hover arrives through forwarded mouse events) and runs one drift timer every 3–6 minutes. The caption window exists only during a voice or dictation turn. The island no longer polls media every eight seconds: it reads media on start, on foreground-app changes, on hover and when the drawer closes, and polls every 15 seconds only while something is playing. See the v0.2.0 comparison above for measured idle figures.
- Hardware metrics refresh while the Stats view is mounted (every 2.5 seconds). CPU load and memory are read directly; GPU, disk, process and network queries run in the background on 10/30/8/2-second schedules only while Stats keeps asking, so the tab opens without waiting for Windows queries.
- Controls refresh every six seconds while that panel is open, the island media card re-reads media every five seconds only while it is open, and Windows media-script results are cached for six seconds while active or 30 seconds while inactive. In-flight PowerShell/native-script requests are deduplicated.
- A live Gemini socket and audio buffers exist during an explicit voice session. They should close and release temporary data after the user ends the turn/session.
- Lasso capture temporarily holds a display image and opens an overlay only while the selection is active.
- The file wheel's drag hook runs inside the existing Windows host, so it adds no process. Its wheel, shelf, tool and float windows are created on demand and closed afterwards, and engine downloads start only when a job needs them.

These are source-level observations; they do not establish total CPU or RAM consumption. Browser/Electron process layout and Windows accounting can vary by machine and Electron version. The short baseline above is not a peak measurement or long-run test.

## Nightglow redesign (2026-10-18): not measured

The Nightglow redesign changed tokens, shared controls (Select, tooltip layer, status chips, meters) and the AI and drawer screens. **No performance measurement was run for it.** Every figure on this page predates it, and the merged build on `main` has not been measured. What the code shows:

- No interval, polling loop or native query was added. The existing Usage retry timer and the Stats, Controls, media and Today timers are unchanged.
- The tooltip layer listens for pointer, focus, key, press and scroll events while it is mounted. Its only timer is the short hover or focus delay for the element under the pointer, and it runs nothing while the pointer is still.
- Select adds window listeners only while its menu is open, and its menu leaves the DOM when closed.
- The sky (`--aurora`, `--stars`) and the glows are static gradients. Spinners (`circle-notch`) turn only while a read, download or install is running.
- The dock, select menus, the home composer, the Soul slots and modal scrims use backdrop blur (`--blur` or a fixed 8–30px blur). Blur costs GPU time while those surfaces are visible. That cost has not been measured. Settings and workbench cards are translucent fills without blur.
- The Soul page's hub veil no longer drifts. The earlier 24-second infinite `veil-drift` animation was removed so the page is still while you only look at it.

The Windows-first idle budget (100–200 MB) and the active-task ceiling (600–700 MB) still need a repeatable packaged run with the procedure below.

## Measurement procedure

For a repeatable idle reading:

1. Record Yami version/commit, Windows version/build, display scale, machine CPU/RAM, power mode, and whether a virtual desktop or security software is active.
2. Reboot or allow startup work to settle. Start Yami from a packaged build and leave the island in the tray with no microphone or provider session active.
3. Use Windows Performance Monitor or Task Manager details to record working set for every process owned by Yami, including the hidden native host. Capture each process name and PID so child processes are not missed or double-counted.
4. Sample at 10 seconds, 1 minute, 5 minutes, and 15 minutes. Record idle CPU over a fixed sampling interval and note scheduled/clipboard activity. Repeat at least three runs and report median and range. The first baseline above sampled only three points after a 10-second settle, so it does not meet this longer-duration procedure.
5. Separately measure open main UI, stats view, clipboard enabled/disabled, a sustained voice turn, lasso capture, and a search. Stop recording and close all sessions between runs.
6. Record GPU memory separately where available. Do not add committed memory to working set or report a single process as the application total.

Public performance claims should include the procedure, hardware/software, build type, number of runs, and aggregate process-tree definition. The 100–200 MB idle and 600–700 MB task budgets remain pending until this procedure yields stable results.

## Optimization principles

- Keep the island and local controls useful without opening a web request or initializing a model connection.
- Start network and microphone activity only in response to an explicit feature action or opted-in setting.
- Avoid high-frequency polling. Prefer native events or OS notifications where they reduce work without making behavior unreliable.
- Cache snapshots only for a short, stated interval and only when it removes repeated expensive calls.
- Release audio buffers, screenshots, sockets, timers, and event listeners on completion, cancel, and window teardown paths.
- Measure packaged behavior; Vite development mode, debug tools, source maps, and hot reload add overhead.
- Re-measure after changing Electron, native hooks, audio capture, metrics, or persistent background features.

## Inspiration research (checked 2026-10-17)

The examples below are comparisons of product patterns and implementation choices. Resource figures are deliberately omitted: repository descriptions, issue threads, and user comments are not controlled memory benchmarks.

| Project or discussion | License/status | Evidence and useful idea for Yami |
| --- | --- | --- |
| [Flow Launcher](https://github.com/Flow-Launcher/Flow.Launcher) | GitHub repository metadata reports MIT. | Windows app/file launcher with community plugins; useful reference for fast keyboard-first launch and extensibility boundaries. This does not imply Yami should load third-party plugins. |
| [Handy](https://github.com/cjpais/Handy) | GitHub metadata reports MIT. | Offline-first speech-to-text app built in Rust; useful comparison for explicit capture sessions and local privacy choices. Yami’s current Gemini dictation is cloud-based. |
| [Nectar](https://github.com/kua8/Nectar) | GitHub metadata reports GPL-3.0. | Windows notch/dock app; visual and interaction reference only. Review GPL terms carefully; no code or assets are copied into Yami. |
| [Microsoft PowerToys](https://github.com/microsoft/PowerToys) | GitHub metadata reports MIT. | Suite of Windows utilities; useful comparison for separating independent system tools and documenting per-utility permissions. |
| [Reddit: Windows apps people consider lightweight](https://www.reddit.com/r/windows/comments/6uwixq/what_are_your_top_lightweight/) | Community discussion; not a benchmark or license record. | Treat “lightweight” as a user expectation that needs a local measurement method, not as evidence for any particular app’s RAM use. |
| [Reddit: open-source Windows apps](https://www.reddit.com/r/windows/comments/wlc4ov/open_source_windows_apps_you_might_have_not_heard/) | Community discussion; content is anecdotal and may change. | Shows discovery and trust are part of choosing desktop utilities; Yami should link to source, license, and data flow. |
| [Hacker News: Windows native app development is a mess](https://news.ycombinator.com/item?id=47475938) | Community discussion and linked opinion article; not a benchmark. | The thread contrasts native APIs with web-based desktop tooling. Yami’s current Electron choice favors UI iteration and TypeScript reuse, while Windows actions stay in a narrow native host. |

The license values above were read from the official GitHub repository API on the stated date. Recheck each repository’s license file and dependency notices before borrowing code or redistributing assets. Community posts inform questions to investigate; they do not establish current facts about performance or project health.
