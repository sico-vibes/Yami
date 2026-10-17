# Performance goals and measurement

Yami is designed to sit quietly on a Windows desktop for long periods. The app should minimize background activity while retaining the island and scheduled actions. The budgets below are goals, not measured claims about the current build.

## Budgets and current status

| State | Working set target | CPU target | Status |
| --- | ---: | --- | --- |
| Idle with island and tray, no request active | 50–100 MB total for the Yami process tree | Near-zero sustained CPU, with short event-driven wakeups | **Idle memory target not met** in the first short production-source sample. Packaged follow-up also misses the idle target; longer-duration testing remains pending. |
| Active feature use | Keep the Yami process tree below 600–700 MB when practical | Bound expensive polling and release temporary media/capture buffers | Ceiling target; provider, Electron renderer, and selected feature can create short-lived spikes. |

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

## Current sources of background work

- Main process checks due tasks every five seconds. A separate Windows waitable timer asks the operating system to wake at the next scheduled action.
- Clipboard history polls every 1.8 seconds while enabled; polling skips known private contexts and pauses briefly after Yami writes text.
- Global keyboard and mouse hooks remain active while Yami is running and shortcuts are enabled. These hooks support hold-to-talk, dictation, lasso, launcher, and ability input.
- The tray and island remain active while the main window is hidden. Electron windows use `backgroundThrottling: true`. The cat spirit requests animation frames only while active and cancels its loop once settled (zero frames at idle in the browser preview). The optional **Living flame** setting deliberately keeps one animation loop per visible Yami running at idle. The roaming window adds one small transparent renderer when **Let Yami roam** is on and hides while a fullscreen app is in front; it does not poll the cursor (hover arrives through forwarded mouse events) and runs one drift timer every 3–6 minutes. The caption window exists only during a voice or dictation turn. The island no longer polls media every eight seconds: it reads media on start, on foreground-app changes, on hover and when the drawer closes, and polls every 15 seconds only while something is playing. See the v0.2.0 comparison above for measured idle figures.
- Hardware metrics refresh while the Stats view is mounted; renderer interval is 2.5 seconds and main-process values are cached for 1.5 seconds.
- Controls refresh every six seconds while that panel is open, the island media card re-reads media every five seconds only while it is open, and Windows media-script results are cached for six seconds while active or 30 seconds while inactive. In-flight PowerShell/native-script requests are deduplicated.
- A live Gemini socket and audio buffers exist during an explicit voice session. They should close and release temporary data after the user ends the turn/session.
- Lasso capture temporarily holds a display image and opens an overlay only while the selection is active.

These are source-level observations; they do not establish total CPU or RAM consumption. Browser/Electron process layout and Windows accounting can vary by machine and Electron version. The short baseline above is not a peak measurement or long-run test.

## Measurement procedure

For a repeatable idle reading:

1. Record Yami version/commit, Windows version/build, display scale, machine CPU/RAM, power mode, and whether a virtual desktop or security software is active.
2. Reboot or allow startup work to settle. Start Yami from a packaged build and leave the island in the tray with no microphone or provider session active.
3. Use Windows Performance Monitor or Task Manager details to record working set for every process owned by Yami, including the hidden native host. Capture each process name and PID so child processes are not missed or double-counted.
4. Sample at 10 seconds, 1 minute, 5 minutes, and 15 minutes. Record idle CPU over a fixed sampling interval and note scheduled/clipboard activity. Repeat at least three runs and report median and range. The first baseline above sampled only three points after a 10-second settle, so it does not meet this longer-duration procedure.
5. Separately measure open main UI, stats view, clipboard enabled/disabled, a sustained voice turn, lasso capture, and a search. Stop recording and close all sessions between runs.
6. Record GPU memory separately where available. Do not add committed memory to working set or report a single process as the application total.

Public performance claims should include the procedure, hardware/software, build type, number of runs, and aggregate process-tree definition. The 50–100 MB idle and 600–700 MB task budgets remain pending until this procedure yields stable results.

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
