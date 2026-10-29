# Development, build, and release

Yami’s renderer can be developed in a browser preview, but Windows integration and package checks must run in the Windows desktop app. This project currently targets an unsigned portable Windows build.

## Requirements

- Windows 10/11 for the native host, shortcut hooks, UI Automation, screen capture, wallpaper, system controls, and package verification.
- Node.js and npm compatible with the versions used by the project’s pinned lockfile.
- Windows PowerShell and the .NET Framework C# compiler in `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` for native compilation.
- Microphone and network access for testing live AI features. Use your own keys entered through Settings; never add keys to an environment file, test fixture, shell history, or documentation.

## Main commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies recorded in `package-lock.json`. |
| `npm run dev` | Build the native host, start Vite, then run Electron against the development server. |
| `npm run preview:web` | Start the renderer in a browser with a fixture bridge for UI development; it has no Windows effects or live provider connection. |
| `npm run build:native` | Compile `native/Host.cs` and copy the PowerShell helper scripts into `native/bin/`. |
| `npm run docs` | Build the standalone Markdown documentation viewer at `Documentation/index.html` from `Documentation/docs-manifest.json` and its Markdown pages. |
| `npm run notices` | Collect the installed runtime package graph, upstream license texts and asset attribution into `Documentation/assets/third-party/`. |
| `npm run check:lines` | Check the repository’s authored-file line limit. Generated/vendor files are handled separately by the script. |
| `npm run typecheck` | Run TypeScript without emitting output. |
| `npm run build` | Check the source line limit, build the native host, typecheck, build the Vite renderer, and bundle Electron main/preload. |
| `npm start` | Start the built Electron app. |
| `npm test` | Run Node’s built-in test runner on `tests/*.test.mjs`, including policy/provider contract tests and actual native-host tests where supported. |
| `npm run check` | Run the line-limit check, TypeScript check, and tests. |
| `npm run package` | Build and create an unsigned Windows portable executable with electron-builder under `release/`. |

`npm run preview:web` binds a Vite development server to `127.0.0.1:5174`; set `YAMI_PREVIEW_PORT` to use another port for both the server and `scripts/verify-preview.mjs` when 5174 is taken. Its preview toolbar lets you switch among Home, Bond, Soul, Desk, Settings, Island, Controls, Today, Stats, Clipboard, Apps, Wallpaper, Power, Stray (roaming Yami), Caption (the bottom caption pill), AI, Terminal, File wheel, Background (the file wheel tool window) and Setup (Choose your Yami), which is 20 screens in total; `?stage=1&screen=<name>` renders one screen on its own; **Reset demo** restores the in-memory fixture state. A toolbar link opens the generated documentation viewer. Preview changes are temporary and are not written to desktop data. It does not prove IPC, native actions, microphone capture, scheduling, provider behavior, or privacy behavior. Gemini and Tavily keys are not accepted. The direct M-Lab speed-test control is explicitly blocked in preview; it runs only in the Windows desktop app after its disclosure is accepted. Validate actual behavior in a Windows build.

`npm run audit:ui [screenshot folder]` walks the preview's main pages, Desk's tabs, Tune, ten Settings sections and ten island drawer tabs at 1160×790 and 850×610 (48 states). It reports sideways overflow, elements reaching past the window, text cut off without an ellipsis, click targets smaller than 24×24 px that crowd another target (WCAG 2.2, 2.5.8), animations that keep running with nothing happening, and script errors. With a folder it saves a screenshot of each state for a visual review. It needs the preview running and uses the same `YAMI_PREVIEW_PORT`. The 2026-10-29 run reported 0 issues across 48 states, after these fixes: a 24 px minimum height for buttons, switches and tabs; 24 px accent swatches and media-mode buttons; Settings now opens each section at its top; and the Downloads, Tune and Modules texts were updated.

## Source map

- `src/` — React/TypeScript renderer and styles. `src/main.tsx` picks the component from `?window=` (main, island, lasso, effect, stray, caption).
- `src/MainNavigation.tsx` — main dock buttons and event-driven selected-pill positioning, with finite CSS transitions.
- `src/workbench/` — the lazy AI workspace (Sessions, Usage, Connections, Context, Dictation, Notes, Recap, MCP and Workspace settings); `src/workbench-types.ts` holds its shared types. `src/TerminalWindow.tsx` is the lazy xterm.js terminal.
- `src/wheel/` — file-wheel window, tool windows and their command catalogue, gesture rules and in-renderer conversions. `src/styles/wheel.css` and `src/styles/workbench.css` hold their styles.
- `src/yami/` — the Yami character: `YamiSpirit.tsx` renders, `motion.ts` holds the tested flame and pose maths, `features.ts` the face and ears, `skins.ts` the colourways.
- `src/Island.tsx`, `src/Utilities.tsx`, `src/Today.tsx`, `src/MediaPeek.tsx` — the island notch, drawer tabs, Today panel and now-playing card.
- `src/Loadout.tsx`, `src/LoadoutHub.tsx` — loadout catalogue and the orbiting hub; `src/Stray.tsx`, `src/Caption.tsx` — roaming Yami and caption pill.
- `src/controls.tsx` — shared `Select`, `TooltipLayer`, `StatusChip`, `Meter` and the `shortTime` and `relativeTime` helpers. `src/status-tone.ts` maps status words to colour families; `tests/status-tone.test.mjs` covers it.
- `src/ui.tsx` — Icon, IconButton, Toggle, Empty and Modal. `src/island-bounds.ts` — island window size for the notch, media card and each drawer tab, shared by `electron/main.ts` and the preview.
- `src/style.css` — imports the stylesheets in `src/styles/`: `tokens.css` (Nightglow tokens), `base.css` (reset, type, buttons, fields, window frame, dock, modals), `controls.css` (Select, tooltip, chips, meter, checkbox, disclosure), `home.css`, `sidebar-pages.css` (Settings and AI layout, rows, toggles), `loadout.css` (Soul, Bond, Desk), `island.css`, `drawer-tabs.css`, `overlays.css`, `today.css`, `responsive.css`, `workbench.css`, and `cards.css` (entry, usage, recap, notes, form and engine cards). `wheel.css` is imported only by the file-wheel window.
- `src/migrations.ts` — saved-data upgrades run on start.
- `src/default-settings.ts` — shared settings defaults for desktop and browser fixtures.
- `src/preview/` — browser-only fixture state and bridge. Preview changes are temporary and are not written to desktop data.
- `electron/main.ts` — application lifetime, main and island windows, tray, IPC routing, state coordination, task schedules, network helpers, and action dispatcher.
- `electron/requests.ts` — IPC request handler and feature action dispatch.
- `electron/workbench/` — AI workspace controllers: `index.ts` routes validated IPC; `agents.ts` and `hooks.ts` handle agent sessions and approvals; `usage.ts`, `connections.ts`, `local-model.ts` and `mcp.ts` make the opt-in network requests; `terminal.ts` and `terminal-host.ts` run the PTY sidecar; `speech.ts`, `meetings.ts`, `context.ts`, `storage.ts` and `transcripts.ts` cover speech, recordings, selected context, `workbench.json` and transcripts; `network.ts` checks server URLs (HTTPS, or loopback HTTP only) and refuses credential-bearing query parameters.
- `electron/wheel/` — file-wheel service, engine catalogue and downloads, command plans (`perform.ts`, `perform-tools.ts`), archive, PDF and document conversion, file actions and the HEIC probe.
- `electron/native-path.ts` — resolves the native host executable from `host-manifest.json` and rejects a manifest whose name does not match the content-hash pattern.
- `electron/windows.ts` — sandboxed window factory (`makeWindow`).
- `electron/overlays.ts` — roaming Yami window, caption pill window, caption notices and tool-activity events; `electron/activity.ts` labels tool calls.
- `electron/focus-timer.ts` — Today focus countdown; `electron/controls.ts` — volume, brightness and radio controls.
- `electron/platform.ts` — PowerShell/native-script helpers with request deduplication and short result caching.
- `electron/metrics.ts` — instant Stats samples with background refresh of slow queries.
- `electron/weather.ts` — optional city/IP-to-weather lookup.
- `electron/assistant.ts` — Gemini calls, realtime session, declared model tools, Tavily research, and Wikipedia fallback.
- `electron/policy.ts` — URL, target, and advanced-tool checks.
- `electron/preload.ts` — narrow renderer bridge.
- `electron/store.ts` — local persistent state and encrypted credentials.
- `native/Host.cs` — Windows message-line host and Win32/UI Automation actions. `native/ProcessJobs.cs` owns Job Objects for helpers and shells.
- `native/Hook.cs` — short-lived relay that agent CLI hooks run to reach the pipe; `native/Speech.ps1` — installed Windows speech recognition.
- `native/Wheel.cs` — drag-and-tap wheel hook and file-wheel hotkey.
- `native/Media.ps1`, `native/Radios.ps1`, `native/ExplorerSelection.ps1`, `native/SendToLink.ps1` — Windows helpers.
- `tests/` — unit and integration fixtures.
- `scripts/` — build, startup, verification, icon (`export-spirit.mjs`, `create-icon.mjs`), performance measurement and fixture commands.
- `.claude/skills/yami/` — the Yami development skill for coding agents: stack, design language, recipes and the documentation duty.
- `.agents/skills/yami/` — the project-scoped Codex installation of the same skill, including its reference files. Invoke it as `$yami` in this repository. Keep it in sync with `.claude/skills/yami/` when updating the skill. It is not installed in a user-wide skills directory. Codex detects local skills automatically; restart Codex if it does not appear in the skill selector.

## Validation by change type

For an upstream feature adaptation, read [Adaptation rules](adaptation.md) first. Record the source revision/license and behavior-to-Yami mapping before implementation, then verify the real Windows operating path as well as the reused presentation. [Desktop adaptation research](research/adaptation-review.md) contains the Coucou, Terax and CodeNotch feasibility notes; these are proposals, not installed capabilities.

Pick relevant checks; do not treat them as interchangeable:

- For pure renderer changes, use browser preview and typecheck/build. Review keyboard navigation, focus, reduced motion, and both dark surfaces where affected.
- For main-process policy or persistence changes, run `npm test`; inspect migration behavior against existing data formats and key preservation.
- For native code changes, build the C# host and run the focused native check on Windows. Test against a fixture app or a disposable machine state.
- For screenshot/lasso or shortcut changes, test hold, release, cancel, multi-display coordinates, and focus restoration.
- For package/resource changes, run the packaged smoke check and verify required external assets resolve after packaging.
- For provider changes, use mocked contract tests first. A live request requires a user-owned key entered in Yami and must avoid exposing that key in logs or captured evidence. Clearly separate live results from fixtures.
- Do not run disruptive power or network operations as part of automated verification. Restore changed system state after any focused test.

Verification scripts in the repository include `scripts/verify-dev.mjs`, `scripts/verify-app.mjs`, `scripts/verify-modules.mjs`, `scripts/verify-native-input.mjs`, `scripts/verify-wallpaper.mjs`, `scripts/verify-catalogue.mjs`, and `scripts/verify-packaged.mjs`. Read each script before running it: some checks can change the wallpaper, use clipboard state, or start the full app. The checks have fixture and cleanup behavior, but review it against the machine before use.

## Web preview behavior

The preview loads the same renderer pages and styles as Electron but supplies a browser fixture bridge. Keep fixture data stable, obviously synthetic, and separated from production app state. For each new renderer command, define a safe fixture result so the interface can be exercised without granting real local file, power, provider, microphone, or screen access. Do not make the fixture return “success” for an action the browser cannot perform; show a clear simulated result or unavailable state. `npm run preview:web` is for interface feedback, never a release validation path.

The preview draws the island at the real size of each drawer tab, using `src/island-bounds.ts`. Its fixtures include demo data for the redesigned screens: three usage windows (24%, 78% and 93%), recap events and two changed files on the demo session, and three clipboard entries. All of it is synthetic and has no OS effect.

### Checking a UI change

Check the screen in the preview at the default window size, 1160×790, and at the minimum window size, 850×610 (the minimum set in `electron/main.ts`). Open each menu with the keyboard, move through it with the arrow keys, and close it with Escape. Hover icon buttons to see their tooltips. Compare the screen with Reduced motion on and off in Settings > Behavior. The preview does not show the real island, native windows, display scaling or shortcuts, so repeat the screen in the Windows app before calling it done.

## Package layout

Workspace verification commands:

- `node scripts/verify-modules.mjs`: two isolated profiles. A new profile opens
  Choose your Yami and saves a preset; an existing profile skips setup, keeps its
  chat, wakes the AI workspace on its first request and disposes it when switched off.
  `--download` also fetches the pinned 7-Zip console (about 0.6 MB) into the
  isolated profile and removes it. Other desktop checks start past setup through
  `scripts/test-profile.mjs`.
- `node scripts/verify-projects.mjs`: isolated profile; adds this repository as a
  project, checks its git branch and the detected agent CLIs, refuses unknown and
  uninstalled agents, and opens a terminal tab there. It never starts an agent CLI.
  In a throwaway repository it also adds a task worktree, checks that removing it is
  refused while it has changes, and removes it once clean, keeping the branch.
- `node scripts/verify-desk-widget.mjs`: isolated profile; checks the desk widget is off by
  default, opens with the clock when switched on, fits its window to the card, saves where it
  was moved and closes when switched off, and prints its renderer's private memory.
- `node scripts/verify-filter-lists.mjs`: isolated profile; downloads the real EasyList and
  EasyPrivacy (about 3.4 MB, network read only), checks the rule count, that a local
  `news.localhost` page's ad script is cancelled and its `.ad-slot` box hidden, and that
  Remove deletes the lists; prints the build time and main-process memory.
- `node scripts/verify-remote-screen.mjs`: isolated profile, Yami Remote on loopback
  (`YAMI_REMOTE_HOST`, no firewall prompt); checks screen view and control are off by default,
  fetches a real frame, and refuses control while only viewing is on. It sends a tap, text and
  Backspace to Yami's own chat box only when Windows reports Yami's window as the foreground
  window, and otherwise skips input.
- `node scripts/verify-mailcatcher.mjs`: isolated profile; starts Yami's mail catcher from
  Dev › Projects, sends one message to `127.0.0.1:1025` over SMTP, checks it is listed and opens
  as text, then stops it and checks the port is closed.
- `node scripts/verify-whistle.mjs`: isolated profile; downloads the pinned Needle runner and
  Whistle model (about 18 MB), dictates a sentence synthesized by Windows into Yami's own chat
  box (never another app), and checks the words and a Your words replacement. Restores the
  clipboard.
- `node scripts/verify-history-import.mjs`: isolated profile with `LOCALAPPDATA` and `APPDATA`
  pointed at fixture Chrome and Firefox databases (the PC's real ones are never read); imports
  both and checks the new-tab page lists them.
- `node scripts/verify-ssh-menu.mjs`: isolated profile with a fixture `~/.ssh/config`; picks its
  host from the terminal's shell menu and checks the tab runs `ssh` without reaching a server.
- `node scripts/verify-terminal-layout.mjs`: isolated profile; opens two tabs, moves one into a
  temporary folder, restarts Yami and checks both tabs come back with that folder.
- `node scripts/verify-windows-search.mjs [name]`: isolated profile; finds a file name through
  Windows Search under the user's folder and checks the launcher refuses to open a path it never
  listed. Nothing is opened.
- `node scripts/verify-passwords.mjs`: isolated profile and a local sign-in page; imports a
  fixture CSV, deletes it on request, fills the page from the toolbar key, and checks a fill cannot
  be asked for from outside the browser window.
- `node scripts/verify-whistle-live.mjs`: isolated profile; Chromium's fake microphone plays a
  synthesized sentence, dictation starts in the island, and the caption must show its words
  while recording; the recording is then cancelled so nothing is typed.
- `node scripts/verify-wheel-engines.mjs [engines folder]`: isolated profile; downloads ffmpeg,
  ImageMagick and 7-Zip through the pinned downloader (about 140 MB; pass an earlier run's
  `engines` folder to reuse all but ImageMagick) and converts a PNG and a WAV from the wheel.
- `node scripts/verify-dns-live.mjs [adapter]`: **live, only with approval.** Switches one
  adapter to Quad9 with DNS over HTTPS and back to Automatic; each step shows a UAC prompt.
- `node scripts/verify-theme-live.mjs`: **live, only with approval.** Switches light/dark and
  back, and applies and undoes Tune's accent tweak, restoring the exact earlier values;
  screenshots go in the profile folder.
- `node scripts/verify-admin-live.mjs`: **live, only with approval.** Makes a restore point,
  stops DiagTrack and puts it back; three UAC prompts.
- `node scripts/verify-audio-output.mjs`: isolated profile; switches the default output to
  another device for about a second and back (sound moves briefly).
- `node scripts/verify-fanout.mjs`: isolated profile; puts stand-in `claude.cmd` and
  `codex.cmd` first on PATH so no real agent starts, fans one task out in a throwaway
  repository, and checks the two branches, the task files, that git ignores them, the
  command each stand-in received, the refusals (one agent, an uninstalled one, a
  repeat), the Compare view for their two different changes, and removing both worktrees.
- `node scripts/verify-tune.mjs`: applies and undoes every Tune tweak with real
  `reg.exe`, confined to a throwaway `HKCU\Software\YamiTuneVerify-<time>` key through
  `YAMI_TUNE_ROOT`, checks that real Explorer settings did not change, and deletes the
  sandbox. It never restarts Explorer.
- `node scripts/verify-terminal-ports.mjs`: isolated profile; types a one-line Node web server into a terminal tab on a random port and checks that **Servers this tab started** lists it with `node`, and that a server the script itself runs is not listed.
- `tests/osv.test.mjs`: lockfile reading (v1–v3, links and odd versions skipped) and the OSV batch and summary requests. The live check ran against Yami's own lockfile.
- `node scripts/verify-focus.mjs`: needs the internet for the block list; shield on a spare port. Starts a 1-minute focus session with Keep awake and Block sites, checks both took effect, presses Stop, and checks both were undone while your own block rule stayed. `tests/focus.test.mjs` covers cleaning the site list.
- `node scripts/verify-radio.mjs`: needs the internet; lists popular stations, plays one of the first four at zero volume until the player says Playing, checks an unlisted stream is refused, and stops. `tests/radio.test.mjs` covers station parsing, mirror fallback and favourites.
- `node scripts/verify-holidays.mjs`: needs the internet; checks holidays are refused while off, turns them on from Today's button, and asks Nager.Date for this PC's region and year. `tests/holidays.test.mjs` covers the cache, regional holidays and unsupported countries.
- `node scripts/verify-currency.mjs`: needs the internet; asks Frankfurter for one real USD→EUR rate and types `100 usd to eur` into the launcher. `tests/currency.test.mjs` covers parsing (and that unit questions are left alone) and the six-hour cache.
- `node scripts/verify-screen-tools.mjs`: isolated profile; opens a test window in a known colour under the pointer, picks its centre through the picker overlay and checks the copied colour and history (your clipboard text is restored), then pins, unpins and snaps a throwaway PowerShell window to the left half (reading its rectangle back from Windows), refusing to act unless that test window is Yami's target. `tests/snap.test.mjs` covers the launcher's snap commands. It also saves a workspace, checks the test window is in it with `powershell.exe` and its size, and forgets it; restore is not run, because it would move your windows. `tests/workspaces.test.mjs` covers matching by program and title, starting closed apps and the shell windows that are not started.
- `node scripts/verify-keep-awake.mjs`: isolated profile; switches Keep awake on, changes its mode and length, switches it off, and checks through `powerSaveBlocker.isStarted` that exactly one request is held while on and none after. `tests/keep-awake.test.mjs` covers the timer and mode switching.
- `node scripts/verify-dock.mjs [folder]`: isolated profile; turns the dock on, checks a throwaway PowerShell window appears with a running dot, pins and brings forward only that window, and turns the dock off. The taskbar auto-hide is read, never changed.
- `node scripts/verify-downloads.mjs`: local server only; pastes a link in Desk › Downloads and checks the 5 MB file arrives in parts with matching bytes, then opens a download link in the Yami Browser and checks the manager catches and finishes it. `tests/downloads.test.mjs` covers names, parts, pause and resume across a restart, plain streams and refused links.
- `node --experimental-transform-types scripts/verify-extension.mjs [folder]`: starts Yami's browser link on its real port, loads the prepared Yami Home extension into a throwaway Microsoft Edge profile (never yours), checks the new tab and the Customize panel, and has the extension's background hand a link to the link. `tests/browser-link.test.mjs` covers the key, ping, refused links, restart and switching off.
- `node scripts/verify-peek.mjs`: opens quick-look previews of test files directly (no Explorer window): HTML shown as text with its script not run, an SVG shown with its script not run, a second open closing it, and unknown kinds and folders refused. `tests/peek.test.mjs` covers file kinds and escaping.
- `node scripts/verify-accent.mjs`: no key reaches Windows. With `YAMI_ACCENT_TEST=1` the native host runs fed key steps through the accent logic and returns what it would type; the check covers off by default, choosing, wrapping, held-letter repeats, Esc, fast typing and the strip window opening.
- `node scripts/verify-hosts.mjs`: works on a copy of this PC's hosts file (`YAMI_HOSTS_FILE`, written without a prompt): adds an entry on the page, switches it off, presses **Put back**, and checks the copy and the real file are exactly as before. `tests/hosts.test.mjs` covers parsing, line endings, exact restore and the elevated script refusing other lines.
- `node scripts/verify-env.mjs`: copies your user variables into a throwaway `HKCU\Software\YamiEnvVerify-<time>` key (`YAMI_TUNE_ROOT`), adds a folder to Path on the page, presses **Put back**, and checks the sandbox and your real variables are exactly as before. `tests/env.test.mjs` covers names, types, the announcement and exact restore.
- `node scripts/verify-cursors.mjs`: copies your pointer values into a throwaway `HKCU\Software\YamiCursorVerify-<time>` key (`YAMI_TUNE_ROOT`), picks Windows Black and size 3 on the page, checks the sandbox values, presses **Put back**, and checks both the sandbox and your real values are exactly as before. Windows is not asked to reload pointers in the sandbox. `tests/cursors.test.mjs` covers scheme order, user schemes, size values and exact Put back.
- `node scripts/verify-space.mjs`: reads only. Lists the real drives on the page, measures a sandbox folder with known sizes (including an empty folder and a non-ASCII name), checks refusals, and times one measurement of your home folder.
- `node scripts/verify-cleanup.mjs`: cleans only a throwaway folder through the page (`YAMI_CLEANUP_ROOT`): measures, picks the Recycle Bin by hand, confirms, and checks what was removed and kept. A second launch measures this PC's real folders and removes nothing. `tests/cleanup.test.mjs` covers the day-old rule, kept folders, junctions not followed, and that `Yami.FileStats.exe` agrees with the Node walk.
- `node scripts/verify-shield-live.mjs [adapter]`: **live, only with approval, at the PC.** Turns the network shield on at port 53, points the adapter at the Yami shield profile (UAC prompt), checks through Windows' own resolver that a listed name gets `0.0.0.0`, `example.com` resolves and the shield counted the lookups, then puts the adapter back as it was (second prompt). Each prompt times out after two minutes; on 2026-10-29 the first four attempts' prompts went unanswered (each ended at the two-minute limit) and changed nothing; with the owner present it passed: 15 lookups through the shield, the listed name blocked (`ENOENT` from Windows' resolver, which reports `0.0.0.0` answers as not found), `example.com` loaded, and the adapter back on `192.168.1.1`.
- `node scripts/verify-shield.mjs`: needs the internet; isolated profile. Turns the network shield on through the page on a spare port (`YAMI_SHIELD_PORT`), downloads and parses the StevenBlack list in its child process, checks a listed name gets `0.0.0.0`, `example.com` is answered by Quad9 over DNS over HTTPS and a local-only name is not sent out, reads the counts on the page, and checks that off closes the port. It never changes an adapter's DNS. `tests/shield.test.mjs` covers list parsing, the packed name search, DNS messages, truncation and the TCP retry, and your own rules.
- `node scripts/verify-apps.mjs`: isolated profile; registers fake apps in a throwaway
  `HKCU\Software\YamiAppsVerify-<time>` key through `YAMI_APPS_ROOT`, checks which are
  listed (duplicates, system components, updates and entries without an uninstaller are
  left out), searches and uninstalls one through the page, and checks that its fixture
  uninstaller (a `.cmd` that writes a marker file) ran. No real app is removed.
- `node scripts/verify-feeds.mjs`: needs the internet. Reads Hacker News, the
  electron/electron releases feed and r/rust in an isolated profile, then opens the Inbox.
- `node scripts/verify-agentlink.mjs`: isolated profile; turns on Yami for your
  agents, then speaks MCP to the endpoint as an agent would: token refusal, notify,
  ask_user through the visible approval card, tool switches and token rotation.
- `node scripts/verify-browser.mjs`: a local test page, no internet; checks tabs, the page
  view's placement, refused `javascript:`, background-tab sleep and an agent reading the
  page over MCP.
- `node scripts/verify-media.mjs`: plays a silent page in the Yami Browser so it owns a
  Windows media session ("Yami media check"), then sends play/pause, next and seek only
  while that is the current session. Your own player is never acted on.
- `node scripts/verify-terminal-shells.mjs`: lists the detected shells, opens a Git Bash
  tab when Git for Windows is installed, runs a harmless `echo`, and finds its output with
  the scrollback search, then checks split view: two panes, swapping, three and four panes in a
  2×2 grid, and back to one. It then opens
  each installed shell in a temporary folder and checks the folder, `Exit 4` and the copied last
  block from shell integration (restoring the clipboard), and the hidden-window notice for a long command.
- `node scripts/verify-workbench.mjs`: isolated Windows Electron profile; native
  approval relay, persistent PTY, resize, interruption and descendant cleanup.
- `npx electron-builder --win --dir` followed by
  `node scripts/verify-workbench.mjs --packaged`: unpacked checks without applying
  a wallpaper or accessing real accounts. `YAMI_PACKAGE_DIR` overrides the output
  directory. This does not publish a release or bump the version.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-offline-speech.ps1`:
  installed recognizer against a synthetic WAV; no microphone or network.
- `node scripts/capture-workbench.mjs`: synthetic screenshots and 850/1160px checks
  against the running preview server. Preview adds **AI** and **Terminal** for 17
  screens; `src/preview/workbench.ts` blocks recording and credentials.

Native builds select `Yami.Native-<source-hash>.exe` through an atomic
`host-manifest.json`. This permits builds while the old app remains open. Never
close the user's app merely to replace a binary. Legacy packages without a
manifest can use `Yami.Native.exe`. See [workspace support limits](workspace.md).

Vite output under `dist/` and Electron output under `dist-electron/` are bundled into the app. The package includes `package.json` plus those outputs and copies the compiled native executable and scripts to a `native` resource directory. User-facing wallpaper, city data, and app icons are copied to `assets`. Electron-builder’s Windows target is `portable`, product name is `Yami`, app ID is `in.yami.desktop`, and executable signing is disabled in current configuration.

The resulting portable binary is not signed. A release owner must decide signing and update behavior before publishing broadly. The Yami repository is intentionally private during development even though the source is intended for MIT open-source distribution.

Windows packaging copies the Electron distribution already installed under `node_modules/electron/dist`, keeping the runtime consistent with the lockfile and avoiding a second archive extraction. If that folder is missing (for example after `npm ci` in a fresh checkout where the Electron binary was not downloaded), run `node node_modules/electron/install.js` before packaging. `npm run package` fails with "electronDist does not exist" until it is present. Build on Windows. A local output override, `--config.directories.output=release/current`, can keep a new build separate from an earlier package.

## Release checklist

1. Review the complete diff, especially data migrations, IPC, confirmations, and native actions.
2. Confirm no API keys, user conversations, clipboard contents, personal screen captures, `.artifacts`, or local configuration is included.
3. Generate a dependency and asset license inventory from the exact locked dependency graph. Include required license texts and attribution in the package; see [Asset and third-party provenance](assets-and-licenses.md).
4. Build and typecheck on Windows, run relevant tests, and verify the portable package rather than only development mode.
5. Verify fresh install/start, upgrade with existing conversations, settings, and API keys, tray exit/reopen, microphone denial, and missing/unsupported device paths. Model-ID fallback must not reset saved user data or credentials.
6. Confirm bundled assets load and no reference wallpapers lacking redistribution permission remain in the release.
7. Record version, commit, artifact digest, validation, platform, known limitations, and provider/model availability caveats in release notes.

## Contribution and security

See [CONTRIBUTING.md](../CONTRIBUTING.md) and [SECURITY.md](../SECURITY.md). Report security issues privately while no public advisory process is configured. Yami’s local native host is not a sandbox; terminal access acts with the current user’s privileges.
The native test accepts only Windows HRESULT `0x80070490` for the volume operation on machines with no default audio endpoint (such as hosted Windows CI). Other errors fail the test. This does not verify an audio write on CI: volume behavior still needs an interactive Windows device check.
