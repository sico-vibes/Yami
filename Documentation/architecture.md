# Architecture

Yami is a Windows desktop application with a web renderer and a local Windows integration process. Its architecture keeps operating-system actions and provider credentials out of the renderer.

## Process map

```mermaid
flowchart LR
  UI[React renderer] -->|narrow preload API| E[Electron main process]
  E -->|JSON lines over stdin/stdout| N[C# Windows host]
  E -->|@google/genai SDK| G[Gemini Developer API]
  E -->|HTTPS fetch| T[Tavily API]
  E -->|HTTPS fetch, opt-in| X[AI workspace: usage, connectors, MCP, local model]
  E -->|one-time download, SHA-256 checked| F[Engine hosts: gyan.dev, GitHub, 7-zip.org, SourceForge]
  E <-->|authenticated named pipe| R[Agent CLI hooks via native relay]
  E -->|HTTPS fetch| W[Wikipedia / weather / M-Lab]
  E -->|local files + DPAPI-backed safeStorage| D[Windows user-data folder]
```

The diagram shows request paths, not data ownership. Provider services receive the information needed for each feature; see [Security and provider data flow](security-and-providers.md).

## Renderer

`src/` contains the React and TypeScript UI: home chat, voice island, loadout, plans, settings, launcher, and utility panels. Vite serves the renderer during development and emits the production web assets. The renderer has context isolation enabled, Node.js integration disabled, Electron sandboxing enabled, and navigation locked to the app origin. New windows are denied. The app explicitly grants the media permission used for microphone capture.

The renderer calls `window.yami.invoke(method, args)` and subscribes to events through `window.yami.on(callback)`. `electron/preload.ts` exposes these wrappers and one drop helper, `filePath`, which reads a dragged `File` through Electron’s `webUtils.getPathForFile`. A `File` cannot be cloned through `invoke`. The preload does not expose Node.js objects or raw `ipcRenderer`. The main process verifies that each IPC sender belongs to a registered Yami window, applies validation and permission policy, then dispatches to application logic.

In a web preview, a browser-side fixture bridge substitutes for `window.yami`. It is meant for UI development and does not simulate successful OS effects or real provider behavior.

`src/MainNavigation.tsx` measures the selected dock button when navigation changes and observes dock resizing (including font loading). CSS transitions move its single highlight; a keyed main element runs a finite incoming-page fade. There is no animation loop or polling for navigation, and both transitions honor the app and OS reduced-motion preferences.

The terminal (`src/TerminalWindow.tsx`) and the AI workspace (`src/workbench/`) load lazily, so xterm.js and the workspace screens cost nothing until they are opened. The file wheel and its tool windows (`src/wheel/`) load only in their own transparent windows.

## Electron main process

`electron/main.ts` owns app lifetime, the main window, the transparent top-center island, tray behavior, the launcher, lasso capture, state updates, schedules, app discovery, and confirmation prompts. `electron/requests.ts` builds the IPC request handler and contains feature request dispatch. `electron/windows.ts` creates sandboxed windows. `electron/overlays.ts` owns the roaming stray window and the caption window, and labels tool activity for the island using `electron/activity.ts`. `electron/focus-timer.ts` owns the Today focus countdown. The file wheel is a separate transparent window created for one drag or shortcut and destroyed afterwards (`electron/wheel/service.ts`); its scripts load only in that window. The main process coordinates those modules with the native child process and assistant service.

The AI workspace (`electron/workbench/`) keeps its own routed controllers for agent hooks, quota readers, connectors, local model, MCP, terminal, speech and notes. The file wheel (`electron/wheel/`) is covered under build layout. The assistant and provider policy live in `electron/assistant.ts` and `electron/policy.ts`. `electron/platform.ts` owns reusable PowerShell and native-script helpers; `electron/metrics.ts` samples local hardware; `electron/weather.ts` handles opt-in weather lookup. `electron/store.ts` reads and writes persistent state; it strips key metadata from `data.json`, encrypts API credentials in `credentials.bin`, and encrypts unpinned clipboard text before saving. Writes to the state file use a temporary file followed by rename.

## Provider architecture and extension limits

Provider calls currently live in the Electron main process, apart from the consented M-Lab browser worker. Gemini is wrapped by `@google/genai` in `Assistant`, which handles model discovery, text generation with declared functions, dictation generation, and the Live session. Tavily search/extract and usage are direct `fetch` calls in that assistant/provider flow. Wikipedia is a direct-fetch fallback for research and the optional cached public-news context. Weather and IP geolocation are handled by `electron/weather.ts`; the user-consented M-Lab test runs in the renderer through its worker scripts.

The AI workspace also reads subscription quota and connector status in the main process, and sends requests only to services and MCP or local-model servers the user has configured and enabled. Codex quota is read through its local CLI app-server. The file wheel downloads its helper programs on first use. Terminal shells run in a Node sidecar under Windows Job Objects, not in the renderer.

There is no provider-neutral interface, model router, provider plugin API, or server-side proxy today. Provider-specific request formats and errors remain in the existing modules. A future provider adapter should centralize secret lookup, model/capability discovery, request construction, timeout and cancellation behavior, error mapping, data disclosures, usage reporting, and tests. It must preserve the main-process tool authorization boundary and avoid passing credentials or raw IPC to the renderer. Do not document a provider as supported until the adapter and UI can validate it end to end.

## Native Windows host

`native/Host.cs` and `ProcessJobs.cs` compile to a content-versioned `Yami.Native-<hash>.exe` using the Windows .NET Framework C# compiler. `host-manifest.json` selects the current build without replacing a running binary. Electron launches it as a hidden child process and speaks a JSON-lines protocol over stdin/stdout. Each request has an increasing ID; the host returns a matching result or error and can emit asynchronous events such as shortcut, foreground-window, or ability events.

The host uses Windows APIs and UI Automation for global shortcuts, foreground window discovery/focus, screen capture, clipboard reads/writes, text insertion, monitor brightness, volume, theme, app settings, media key events, and power operations. `native/Wheel.cs` watches the existing low-level hooks for a drag-and-tap and registers the file-wheel hotkey. `native/Media.ps1` and `native/Radios.ps1` supply media-session and radio/night-light operations. `native/ExplorerSelection.ps1` reads the foreground Explorer selection when the shortcut or drag hint needs it. `native/Hook.cs` is the short-lived relay that agent CLI hooks run; it authenticates to the per-profile pipe as the same Windows user. `native/Speech.ps1` runs installed Windows speech recognition, and `native/SendToLink.ps1` creates the Send to shortcut. Hardware-specific calls may fail or be unavailable; code reports an error instead of treating the request as success.

The host is not a hardened isolation boundary. It runs as the current Windows user. Treat native inputs as untrusted and validate new methods in the Electron main process as well as in the host.

## IPC and action path

For a model-requested action, `assistant.ts` sends a declared function tool to Gemini, receives a function call, and passes its name and arguments to the main-process action dispatcher. The dispatcher checks the advanced-tool settings, validates required targets and web URLs, and invokes a confirmation when a tool is sensitive. It then dispatches only known actions to the store, Electron shell, or native host. The tool result or error is returned to Gemini; the app only reports success when an operation returns successfully.

Sensitive actions are enumerated in [`electron/policy.ts`](../electron/policy.ts). A pending confirmation expires after a short timeout and is rejected if the user does not approve. Scheduled tasks run with an `unattended` flag, and sensitive actions are rejected from schedules. The allowed scheduled tool set is separately validated before a plan is stored.

## Background work

The main process checks enabled tasks every five seconds and clipboard history every 1.8 seconds. Clipboard polling is skipped when disabled and pauses briefly after Yami writes to the clipboard. The Controls panel refreshes controls/media every six seconds, the island reads its media hint on demand and polls every 15 seconds only while media is active, the focus timer arms one timeout only while running, and Stats refreshes every 2.5 seconds. Stats answers instantly: CPU load and memory come from Node, while GPU (10 s), disks (30 s), process list (8 s) and network (2 s) are refreshed in the background only while Stats keeps asking, and opening the drawer warms them. PowerShell/native-script work is deduplicated while in flight; media results are cached for six seconds while active and 30 seconds while inactive. These are implementation intervals, not performance measurements; see the [performance budgets](performance.md).

When the next scheduled task changes, Yami asks Windows to set or cancel a waitable wake timer. The AI workspace starts no terminal, helper or model at idle, and its usage, connection and transcript timers are opt-in. The file wheel has no process or window at idle. This is a best-effort request: Windows policy and hardware decide whether a sleeping system wakes.

## Build layout

`electron/workbench/index.ts` routes validated IPC to focused controllers.
`storage.ts` keeps optional settings, notes, dictionary rules, bounded history
and stale quota snapshots in a separate `workbench.json`. Existing `data.json`
remains intact. New keys join the existing DPAPI-backed credentials map with
atomic replacement; renderers see booleans only. Export includes workspace text
and excludes keys; full deletion removes workspace data.

`agents.ts` owns the authenticated per-profile named pipe and expiring requests;
`native/Hook.cs` is a short-lived same-user relay. `hooks.ts` previews and merges
CLI settings with backups. `transcripts.ts` is an opt-in bounded filesystem
watcher. `usage.ts` separates quota windows and freshness/backoff state.
`connections.ts`, `local-model.ts` and `mcp.ts` keep network requests in main.

`terminal.ts` lazily creates a window and Node sidecar (`terminal-host.cjs`)
using node-pty/ConPTY. xterm.js and fit addon form a lazy renderer chunk. Output
credits pause the sidecar stream at 512 KB and resume below 256 KB. Job Objects
own the helper and individual shells, including their descendants. Packaged
node-pty is unpacked for its native addon, DLLs and worker. `speech.ts` handles
rules and Gemini/Windows transcription; `meetings.ts` streams bounded PCM to disk
and commits notes before removing audio. `context.ts` bounds explicit attachments
and tracked Git diffs. See [workspace scope and verification gaps](workspace.md).

`electron/wheel/service.ts` owns the file-wheel window, drops and tool dispatch. `engines.ts` and `engine-catalog.ts` download and checksum-verify the helper programs. `perform.ts` and `perform-tools.ts` build and run the command plans, and `archive.ts`, `pdf*.ts` and `convert-docs.ts` handle the in-app conversions.

Vite builds the renderer to `dist/`. `scripts/build-electron.mjs` bundles the main and preload TypeScript as CommonJS under `dist-electron/`, with Electron provided at runtime. `scripts/build-native.ps1` builds/copies the native host and PowerShell helper scripts under `native/bin/`. `electron-builder` produces the configured unsigned Windows portable artifact and copies runtime assets to external resources.
