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
  Other desktop checks start past setup through `scripts/test-profile.mjs`.
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
