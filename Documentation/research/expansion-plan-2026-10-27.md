# Expansion plan (2026-10-27)

Status (2026-10-29): **all ten phases built on branch `yami-expansion`, not merged to `main`.** Since the summary below: Whistle runs end to end (English, with live captions); terminal panes, profiles, SSH hosts and restore; Tune's DNS over HTTPS, network shield, cleanup, disk map, installed apps, hosts, environment, pointer and administrator sections; native remote desktop, mods and mail-catcher features in place of the RustDesk, Windhawk and Mailpit bridges (owner's native-feel rule); Outlook and Bluesky sign-in; the download manager, Yami Home extension, dock and desk-widget styles; a UI audit; and small windows sharing the island's renderer (153 MB idle packaged). Still needing the owner: signed-in accounts, a real phone, a real hosts-file write and physical accent and quick-look key tests. Earlier status, 2026-10-28: Built: the module registry, first-run setup and pack downloads; an on-demand main window; the Phase 1 revamp; and the Dev hub (projects, agent launcher, parallel-task worktrees, island cycling, Yami for your agents over MCP, command palette, secret masking, Git Bash and WSL shells, terminal search). Also built: Whistle dictation, Tune (HKCU tweaks, startup apps, DNS switcher) with a light and dark schedule, wheel folders and OCR, media-session control, lyrics and optional Spotify. Then the Feeds inbox (social feeds, mail glance, Brief me), Yami Remote, companion reactions, and the Yami Browser with Vault, Linked mode, blocking, reader and history. Each feature page lists its unbuilt parts as gaps. This page records the owner-approved direction and phase order from 2026-10-27. Sources were checked on that date; items marked **verify** have not been confirmed on Windows. Shipped behaviour is described only in [Features and settings](../features-and-settings.md) and the [roadmap](../roadmap.md).


## Context

The owner wants Yami to become an all-in-one Windows companion. That covers styling and optimizing Windows, local dictation on Cactus Whistle, a Tangerine-style file wheel, a feature-rich but light terminal with project management, deep hooks into every AI coding CLI, Spotify and media control, news, mail and social feeds, free connectors, and remote and local servers. All of it has to stay lightweight and look like one Nightglow product. They also asked for a revamp of recently added screens that drifted from the design language.

Yami already ships a lot of this, so the plan extends what exists rather than rebuilding it:
- file wheel (`electron/wheel/`, `src/wheel/`)
- ConPTY terminal with tabs (`electron/workbench/terminal*.ts`, `src/TerminalWindow.tsx`)
- hooks for Claude Code, Codex, Gemini, Copilot, Cursor and OpenCode (`electron/workbench/hooks.ts`, `agents.ts`)
- usage readers, read-only connectors, HTTP MCP, a local model and notes
- Windows speech and Gemini dictation (`electron/workbench/speech.ts`)
- SMTC media peek (`native/Media.ps1`)

**Decisions from the owner (2026-10-27):**
- Everything is in scope.
- The idle budget is raised to **100–200 MB** private working set for the full process tree; the active-task ceiling stays 600–700 MB.
- English-only dictation is fine for Whistle.
- Recently added UI must be brought into Nightglow.
- **Every feature is optional.** Users pick features at first run and can install, enable, disable or remove any of them later.
- Add a **Yami Browser**: light, local-only, with MCP-style agent control and a local vault for data imported from other browsers.

**Owner decision (2026-10-28): it must feel native.** Third-party libraries, engines and downloaded tools are fine when Yami's own UI drives them (the file wheel's ffmpeg or ImageMagick, Ghostery's ad-block engine, Whistle). What is out is installing another app and sending people to its window. So Mailpit's web inbox became Yami's own mail catcher, and the RustDesk and Windhawk bridges became Yami Remote's screen view and control and Tune's Look and feel tweaks. When an item gets stuck, it is noted and the work moves on. The sections below are kept as written, for the record.

**Measured today:** idle is 165–172 MB private across 8 processes (`Documentation/performance.md`). That sits inside the new budget with about 30 MB of headroom. So every new feature must be **lazy, toggleable, and zero-cost when off**. That is what Phase 0 builds.

---

## How the work is split (owner's instruction)

**Tooling:**
- Install `amElnagdy/delegate-skills` (MIT) globally for Claude Code: `npx skills add amElnagdy/delegate-skills --skill opencode-delegate --agent claude-code --global`. It stays global so the repo doesn't gain unreviewed skill files.
- OpenCode v2.0.32 is installed. Model: `opencode-go/deepseek-v4.1-flash` at high effort, passed as `-m opencode-go/deepseek-v4.1-flash#<high variant>`. Confirm the variant name on the first dispatch. If it isn't accepted, report back rather than silently using another effort.
- Write lane is the `build` agent.

**Ownership:**

| Owner | Scope |
| --- | --- |
| **OpenCode (DeepSeek V4.1 Flash, high) — backend** | `electron/**`, `native/**`, `scripts/**` (build, measure, check-ui), pack manifest and downloader, IPC request handlers, migrations logic, `tests/**` for backend logic |
| **Claude (me) — frontend and design** | `src/**` screens, components and styles; `tokens.css`; the Phase 1 revamp; Setup and Modules UI; `src/preview/**` fixtures; design-system docs, screenshots and the Yami skill's design reference |

**Workflow:**
- **Contract first.** For each slice, I write the IPC method names, argument and result types (in `src/shared.ts` or `src/workbench-types.ts`) and the settings keys. Then I dispatch a self-contained backend brief that includes AGENTS.md guardrails, the 1,000-line limit, lazy and idle rules, files to touch and tests to add. I build the UI against the preview fixtures in parallel.
- **Review.** I read each backend diff myself, re-run `npm run check` and `npm run build`, and fix or re-brief it before it lands. Nothing is accepted on the delegate's say-so.
- **Commits.** Reviewed slices are committed on a new branch `yami-expansion` (from `nightglow-redesign`), with no push.

**Execution order:**
1. Phase 0: the registry and lazy bundles, then `settings.modules` and its migration, then packs.
2. Phase 1 revamp, mine, in parallel with Phase 0.
3. Measure.
4. Phases 2 through 10 in order. Each phase has a backend slice and a frontend slice.

## Architecture rules for every phase ("lazy everything")

1. **Module registry.** Every pillar is a module with `{ id, setting, load(), dispose() }`. A disabled module is never imported, registers no IPC handlers (requests return `"disabled"`), and starts no timers, watchers, helpers or windows.
2. **Load on first use, unload when idle.** Main-process modules are `require()`d on their first request. Renderer screens use `React.lazy`. After about 5 minutes unused, `dispose()` drops caches, exits helpers and closes sockets.
3. **Helpers are short-lived child processes.** This applies to needle.exe, git, winget, the elevated tweak helper and Mailpit. They spawn on demand, are owned by the existing Job Objects (`native/ProcessJobs.cs`) and are reaped on exit.
4. **Events, not polling.** The native host gets an "event spine":
   - SMTC session events
   - registry change notifications (`RegNotifyChangeKeyValue`)
   - WinEvent foreground hooks (already present)
   - Core Audio callbacks
   - fs watchers, only while a feature is on

   PowerShell-per-call helpers (`Media.ps1`, `Radios.ps1`) move into `native/Host.cs` partial classes.
5. **One window per job, destroyed after use.** The main window is destroyed on close after a grace period, so only the island stays resident. Measure this first. There is one optional desk-surface window, never a window per widget.
6. **Network is opt-in and cache-first.** Use stale-while-revalidate, ETag/If-Modified-Since, fallback chains (OpenTerminal's pattern), refresh-on-open by default, and a minimum interval for optional background refresh.
7. **Downloaded engines** reuse the pinned-SHA-256 downloader (`electron/wheel/engines.ts`, `engine-catalog.ts`). GPL/AGPL tools are downloaded or detected, never bundled.
8. **Nightglow only.** New UI uses the components in `src/controls.tsx` and `src/ui.tsx`, and the recipes in `.claude/skills/yami/references/design-language.md`.
9. **File limit.** Every file stays at 1,000 lines or fewer. `electron/main.ts` (947 lines) gets no new features; each pillar lives in `electron/<pillar>/` and `src/<pillar>/`.

---

## Phase 0 — Foundation: module system, budget, idle wins

- Update the budget in `AGENTS.md`, `Documentation/performance.md`, `Documentation/reference/product-brief.md` and the Yami skill (idle 100–200 MB).
- Add `electron/modules/registry.ts`, plus a `src/modules.ts` mirror with ids, settings keys and cost class (Low/Medium/High). Route `requests.ts` by prefix (`dev.*`, `tune.*`, `feeds.*`…) to the lazily required module.
- Split the main bundle: `scripts/build-electron.mjs` emits per-module CJS entry points next to `main.cjs`. Add Vite `manualChunks` for heavy renderer libraries (xterm, pdf.js, pdf-lib, jsQR).
- **Yami Packs and the "Choose your Yami" setup** (the owner's install-time choice):
  - **What a module is.** Feature *code* always ships inside Yami. It is small and lazy-loaded, so a disabled module costs no RAM or CPU. A module's heavy parts are its **pack**: models, engines and helper binaries. Examples: Whistle 16.9 MB + `needle.exe` 1.6 MB; ffmpeg, ImageMagick, 7-Zip, Mailpit, ad-block lists.
  - **Pack trust.** Packs are listed in a manifest compiled into each release, with URL, size, SHA-256 and licence. They are downloaded by the existing engine downloader. Yami never downloads executable JavaScript or updates manifests remotely, which avoids a supply-chain hole in an unsigned app.
  - **First-run setup** (new `src/setup/Setup.tsx`, shown once, and again from Settings or the tray). It is a Nightglow card grid of modules. Each card shows what the module does, its cost class, download size and the permissions it needs (network, microphone, admin).
  - **Presets:** Essentials (island, voice, utilities), Developer (Dev hub, terminal, agents, browser), Tinkerer (Tune, Style), Everything, or Custom.
  - **Downloads** queue in the background with progress, resume and cancel. Setup works the same for the portable `.exe` and for an optional per-user NSIS installer (electron-builder `nsis`, no admin). The choices live in-app, not in an installer page, so both builds share one Nightglow flow.
  - **Install later at any time.** **Settings › Modules** reuses the same cards. Each one shows install, enable or disable, update pack and remove, along with "loaded now" and its measured cost. Remove deletes pack files and keeps user data unless "Also remove its data" is ticked.
  - **Offline installs:** "Install pack from file…" verifies the same SHA-256.
  - **Data:** module state lives in a new `settings.modules` map. Defaults reproduce today's behaviour, and `src/migrations.ts` carries a migration plus a test.
- Idle wins to measure one at a time with `scripts/measure-performance.mjs --packaged`:
  - destroy the hidden main window
  - replace `Media.ps1` polling with native SMTC events (removes the 15 s poll while playing)
  - replace `Radios.ps1` with in-host calls
  - lazy-require `systeminformation` and `@google/genai`
- Loading states: adopt **ascii-reveal** (MIT, about 15 KB, React peer, honours reduced motion) as `AsciiSkeleton` while a lazy screen loads, with Yami glyphs. Its reveal is finite at about 30 fps, which fits the "animate only for active work" rule. Record its licence in `assets-and-licenses.md` and `third-party-licenses.md`.

## Phase 1 — Nightglow revamp of recently added surfaces

Audit findings (from source):
- **File wheel and tool windows** are the worst offenders:
  - `src/styles/wheel.css` uses raw `rgba()` 17 times, only 13 tokens, and `backdrop-filter` over the real desktop, which the design language says does not work there.
  - It uses the legacy `--accent`.
  - Native `<select>` appears in `src/wheel/ToolApp.tsx` and `WheelApp.tsx`.
  - Tool headers used a plain `×` button instead of `IconButton`, and the Background tool had its own header.
  - Hitodama-era warm colours are hard-coded in canvas tools (`#17140b`, `#bba057` in `MarkupTool.tsx`, `CollageTool.tsx` and `RedactTool.tsx`).
  - The wheel and tool windows do not mount `TooltipLayer`.
- **Terminal:** the xterm theme is hard-coded hex in `src/TerminalWindow.tsx:80`, and its tabs don't use the drawer-tab track.
- **Other screens:** two native `title` tooltips remained (the wallpaper grid in `Utilities.tsx` and the shortcut recorder in `Settings.tsx`), plus native `window.confirm` dialogs in `TerminalWindow.tsx`, `Utilities.tsx` and `Notes.tsx`. (A first grep also counted component props such as `<Modal title>`; those are not tooltips.)

Work:
- **Wheel:** opaque `--ink-0` petals with a hairline `--line`, a lit `--grad-glow` petal for the current target and `--soul` rim on the centre. Use token type sizes and `--ease-fluid` entrances with reduced-motion overrides.
- **Tool windows:** one `ToolShell` layout with a `.page-head`, form cards and `Select`. Mount `TooltipLayer` and convert `title` to `data-tip`. Canvas tools read their palette from CSS variables (`getComputedStyle`): ink, glow, rose and mint.
- **Terminal:** build the theme from tokens. Tabs become the recessed-track pill style. The titlebar matches the main window. Add an ANSI palette token set (`--term-*`) in `src/styles/tokens.css`.
- **Launcher:** restyle as the command palette (Phase 2 feature) with floating-glass recipe.
- **Guard:** add `scripts/check-ui.mjs` (wired into `npm run check`). It fails on raw hex/rgba outside `tokens.css`, on `<select`, and on ` title=` in shipped TSX, with an allowlist for canvas or xterm values read from tokens.
- Re-capture screenshots (`scripts/capture-documentation.mjs`, `capture-workbench.mjs`) and update `Documentation/reference/design-system.md`.

## Phase 2 — Dev & AI hub (the biggest pillar)

Rename the AI dock tab to **Dev**. Its sidebar has Projects, Agents, Terminal, Sessions, Usage, Connections, Context, Notes, MCP and Settings; the existing pages move here.

**2a. Projects.**
- Add folders manually, or auto-suggest from agent-session cwd and terminal cwd.
- Each card shows branch, dirty count and ahead/behind. These come from `git status --porcelain=v2 -b` on open only, never on a poll. It also shows last agent activity, using the existing session registry.
- Card actions: Terminal here; Launch agent ▾; Open in editor (detect VS Code, Cursor, Zed); Explorer; New worktree.
- New files: `electron/dev/projects.ts` and `src/dev/Projects.tsx`.

**2b. Agent launcher.**
- Detect installed CLIs on demand when Dev opens, with a cached result. The scan covers PATH, `%APPDATA%\npm`, `~\.local\bin`, Scoop and winget shims.
- Candidate CLIs (**verify each executable name**): Claude Code `claude`, Codex `codex`, OpenCode `opencode`, Cursor `cursor-agent`, Gemini `gemini`, Copilot `copilot`, **Pi** `pi`, Qwen Code `qwen`, Amp `amp`, Aider `aider`, Crush `crush`, Kilo, Goose.
- Clicking an agent icon opens a Yami Terminal tab in the chosen project running that CLI. The island's AI drawer gets the same icon row.

**2c. Agent radar and island cycling.**
- Hooks stay the source of truth.
- Add a Pi adapter: Pi has a TypeScript extension system, so Yami installs a generated extension that posts to the existing named-pipe relay (same preview, backup and remove flow as `hooks.ts`).
- For hook-less agents, use an on-demand process scan in the native host: a Toolhelp snapshot plus a command-line read for `node.exe`-hosted CLIs. It runs only when the drawer or Dev opens, or on a hook event.
- The island pill shows the most urgent agent, in order waiting › error › working › finished.
- While **two or more agents are active**, the pill cycles every ~4 s and scroll cycles manually. It stops when fewer than two are active. This counts as active work, so it is allowed.

**2d. Terminal upgrades** (Terax, Orca and Warp ideas, each lazy):
- split panes (up to 4)
- shell integration for Yami-launched sessions only: OSC 7 cwd and OSC 133 prompt marks, giving command blocks, exit-code badges, jump-to-prompt and "copy block"
- scrollback search (`@xterm/addon-search`)
- link and file-path detection that opens in the editor
- profiles for PowerShell 7, Windows PowerShell, cmd, Git Bash, detected WSL distros and SSH hosts from `~/.ssh/config`
- layout and cwd restore (not processes)
- a lazy file-tree side panel, read on expand
- "long command finished" island notice when the window is hidden
- a dev-server port finder: the native host calls `GetExtendedTcpTable` filtered to terminal descendants, offering "Open localhost:5173"
- optional WebGL renderer, off by default and measured

The existing bounds, backpressure and Job Objects stay.

**2e. Worktrees and parallel agents** (Orca):
- "New task" runs `git worktree add` on a `yami/<slug>` branch and opens an agent tab there.
- "Fan out" sends the same prompt to N agents in N worktrees.
- Diffs are compared in the existing bounded diff viewer. Review notes are pasted into the agent's terminal explicitly.
- Cleanup removes the worktree after confirmation.

**2f. Yami for agents** (the AI emphasis):
- A **Yami MCP server** (stdio; agents launch `yami-mcp`, which talks to Yami over the authenticated named pipe). Tools:
  - `notify` (island and caption)
  - `ask_user` (approval card)
  - `set_status`
  - `convert_file` (file-wheel engines)
  - `open_project`
- A `yami` CLI exposing the same commands for scripts.
- Every tool is listed with a per-tool allow toggle. Nothing destructive is on by default.

**2g. Command palette.** The `Win+A` launcher becomes a Raycast-style palette over:
- apps, files (Windows Search index instead of the 20k-entry walk)
- settings pages, every module action and projects
- agents ("claude in Yami")
- calculator, units and quicklinks

Use `<` for the keybind list.

**2h. Secret masking** (Magpie idea): context attachments and chat payloads pass through local regex masking for keys, tokens and card numbers before reaching Gemini. Masking can be set to warn or block, and runs in the main process.

## Phase 3 — Whistle local dictation (English default)

- **Engine:** Cactus **Whistle**. It is 16.9 MB, Apache-2.0, and Cactus reports it beats Whisper base on several benchmarks, with 11 ms to first token on an M4 Pro. Vendor numbers; not measured here.
- **Runtime:** the Needle engine, which has a `windows-x86_64/needle.exe` (1.57 MB) plus `libneedle.a` and `needle.h`.
- **Download:** on first enable, through the engine downloader with pinned SHA-256 for `whistle.cact` and `needle.exe` from Hugging Face. Store under `%LOCALAPPDATA%\Yami\engines\whistle`.
- **3a, batch per utterance.**
  1. Existing 16 kHz PCM capture (`src/pcm-capture.ts`) writes a temporary WAV.
  2. Run `needle --model whistle.cact --audio clip.wav`.
  3. Parse stdout.
  4. Feed the dictionary rules (`speech.ts`) and the existing paste path.

  Pass dictionary words as `keywords` biasing if the CLI exposes it (**verify the flag**).
- **3b, live captions:** `--audio-stream` with stdin PCM (**verify stdin support**). Keep a warm process for at most 60 s after the last turn, then exit.
- Add a `whistle` option to the engine `Select` in `src/workbench/Dictation.tsx`. Make it the default for new users only after the Windows check passes; existing choices are preserved, so this needs no migration. Gemini and Windows speech remain alternatives.
- Measure the peak and the return of the full tree during a turn.

## Phase 4 — Windows Tune and Style

**4a. Tune** (WinUtil-inspired; WinUtil is reported MIT — **verify licence**, use ideas and mechanisms, not code verbatim):
- **Declarative tweak catalogue** (`electron/tune/catalog.json`). Each entry has:
  - id, category and risk (`safe` or `caution`)
  - mechanism: registry, service, appx, powercfg or command
  - `detect`, `apply` and `revert`, plus `admin` and `restartExplorer`
- **Categories:** Privacy, Performance, Explorer & taskbar, Start & search, Gaming, Power.
- **Presets:** Minimal and Standard.
- **Flow:** current state is read on page open. Apply shows a preview diff and saves a JSON snapshot of previous values for per-tweak Undo. HKLM, service and appx changes go through a short-lived elevated helper (one UAC prompt per apply batch). An optional restore point is offered first.
- **Excluded (harmful or irreversible):** disabling Defender, toggling BitLocker, removing Edge or OneDrive, disabling IPv6, hosts-file edits.
- **Also in Tune:**
  - Startup manager (HKCU/HKLM Run, the Startup folder and `StartupApproved` toggles)
  - Cleanup with a size preview (temp, recycle bin, shader caches; Windows Update cache needs admin)
  - on-demand disk-space map with a bounded scan
  - **App installer** using winget search, install and "upgrade all"
  - **Repairs** (network reset, `sfc` and DISM) that run visibly in a Yami Terminal tab
  - Windows Update mode (caution)

**4b. Network shield** (AdGuard-inspired, without bundling it):
- A DNS profile switcher per adapter, using Windows 11 native DoH: AdGuard DNS, Quad9, Cloudflare (including family), NextDNS and custom. Applied with admin; Revert goes back to DHCP. It costs nothing at idle.
- If the user runs **AdGuard Home**, connect to its local REST API for stats and a protection toggle (**verify the API**).

**4c. Style:**
- Theme Hub applying one bundle: wallpaper, accent, light or dark, cursor, Yami skin, terminal scheme and sounds, with per-area reset
- scheduled light/dark mode and wallpaper rotation (one timer)
- accent sync through a registry notification
- cursor manager
- folder icons (the `desktop.ini` design already in the recommendations note, §4.2)
- Explorer and taskbar tweaks from the Tune catalogue: classic context menu, file extensions, End Task, taskbar alignment, Start web search
- **Windhawk bridge:** detect an install, show installed mods, link to curated mods. Yami itself never injects into Explorer.
- one desk-surface widget window (clock, weather, media, agents), off by default and measured

## Phase 5 — File wheel → Tangerine and Filee parity

- **Folders and mixed selections:** today `describeWheelFiles` in `electron/wheel/paths.ts` rejects folders. The actions wheel gets: zip, copy path, terminal here, open as project, launch agent here, change icon, folder size, batch rename, flatten, find duplicates.
- **Gestures:** configurable modifier keys. A wheel back face opens with Tab or scroll (Filee's flip). Enter on a selected Explorer file uses the existing `Ctrl+Alt+Y` path, with arrow keys and Enter to pick.
- **Petals and presets:** grouped petals fan out into a second ring of presets. Per-type presets cover quality, resize, DPI, output folder and naming. A toolbar editor pins and arranges petals.
- **Batch:** a parallel pool with a cap, a progress ring and a summary that retries only failures. Automatic route chaining (DOCX → PDF → PNG). Opt-in watch folders using fs events.
- **Engines:** "use my copy" detection for PATH, Scoop and winget installs of ffmpeg, ImageMagick and LibreOffice.
- **OCR:** Windows OCR (`Windows.Media.Ocr`) in the native host. It needs no download.
- **AI:** "Ask Yami about this file" petal; explicit only.

## Phase 6 — Media and Spotify

- Native SMTC (from Phase 0) adds seek, shuffle and repeat, plus position interpolation shown only while the card is open.
- Per-app volume for the active player through Core Audio sessions. Output-device switching (**verify**; the API is undocumented).
- Lyrics from LRCLIB, free and opt-in.
- Album-art colour, sampled once per track, tints the media card.
- **Spotify Web API is optional:**
  - the user brings their own client ID (PKCE)
  - since February 2026, development mode needs the developer to have Premium and allows at most 5 users
  - playback and queue endpoints need Premium
  - SMTC therefore stays the free default that controls the Spotify desktop app

## Phase 7 — Feeds, mail and connectors

- **Feeds engine** (`electron/feeds/`) for RSS, Atom and JSON Feed, with ETag and on-disk cache caps:
  - Reddit through public `/r/<sub>/.rss` (the API needs approval and is non-commercial; **verify RSS stays public**)
  - Hacker News API, GitHub release Atom, YouTube channel RSS, Lobsters, dev.to and any blog
  - Bluesky and Mastodon public timelines (free)
  - X is excluded because its API is paid

  Feeds appear as an **Inbox** in Desk, with an explicit "Brief me" Gemini digest.
- **Mail glance** (Flectar-inspired, not a full client):
  - IMAP with an app password (Gmail), or JMAP (Fastmail)
  - unread count and latest subjects; open in the browser or mail client
  - optional IMAP IDLE (one socket, event-driven)
  - remote images never load
  - read-only; sending would change the no-send policy and needs its own review
  - Outlook.com IMAP requires OAuth (**verify**)
- **Calendar:** ICS countdowns in the island.
- **Free API hub in the palette:** keyless APIs (Frankfurter currency, Nager.Date holidays, dictionaryapi.dev, Wikipedia). A **generic REST connector** (URL template + JSON path → card) covers APILayer-style bring-your-own-key APIs.
- **MCP:** add the stdio transport and saved servers (`electron/workbench/mcp.ts`), so community MCP servers act as free connectors for Gmail, Notion and the like.

## Phase 8 — Remote and local servers

- **Yami Remote (LAN, opt-in):**
  - a small HTTP server that exists only while enabled, with QR pairing, a token and LAN binding
  - a Nightglow mobile PWA for agent status and approvals, media, send-to-clipboard and allowlisted routines
  - off-LAN use documented through the user's own Tailscale; Yami hosts no relay
- **RustDesk bridge:** detect the client, show its ID, launch it, and help set a self-hosted ID and relay server (**verify the config path**). Yami doesn't bundle RustDesk because it is AGPL.
- **Dev mail catcher:** download Mailpit on demand (**verify MIT and checksum**) as a local SMTP sink on port 1025 with a viewer in Dev. Start and stop are explicit.
- **No public mail server.** Port 25 is usually blocked, residential IPs are blocklisted, and deliverability needs DNS, PTR and a 24/7 host. Document this honestly.

## Phase 9 — Companion delight

- A mood engine from signals Yami already reads: battery, CPU spike, music, timers, agent states.
- Yami reacts to agent events: a hop on finish, a worried look on error, looking at you while waiting. Each reaction is finite.
- Embers and achievements for using utilities.
- A spirit-reveal moment (ascii-reveal) when the drawer opens a freshly loaded module.
- A daily brief on request: feeds, calendar, agent recap and mail count.

## Phase 10 — Yami Browser and Vault (module `browser`, off by default)

References:
- **Helium** (imputnet): ungoogled-chromium based; Helium-specific code is GPL-3.0. It contributes the privacy model (no account, local only, built-in blocker, !bangs).
- **Nuphos**: an Apache-2.0 Electron agent workspace with an in-app tabbed browser. It contributes the agent and browser layout.

Neither is forked. Shipping a Chromium fork would add hundreds of MB and GPL obligations.

**10a. Engine.**
- Reuse the Chromium already inside Electron, via `WebContentsView` in one browser window. That means no second engine on disk.
- Session partition `persist:yami-browser`, stored only under Yami's data folder. No account, no sync, no telemetry.
- Content blocking with an Electron ad-blocker library and EasyList/EasyPrivacy filter packs (**verify the library and licence**, e.g. Ghostery's MPL-2.0 one).
- !bangs and a chosen search engine, plus reader mode (Mozilla Readability, Apache-2.0).
- Tabs in Nightglow: a compact vertical rail using the recessed-track tab style.
- **Lazy tabs:** background tabs are discarded after a few idle minutes (the renderer is destroyed and the URL and scroll are kept). At most about 6 live tabs. Closing the window frees everything.

**10b. Logins.**
- Ordinary sites, passkeys and Windows Hello should work. **Verify WebAuthn in Electron on Windows.**
- Google may refuse sign-in from embedded Chromium ("This browser or app may not be secure"). Yami will not spoof the user agent, which is fragile and against Google's terms.
- Instead, Yami offers **Linked browser mode**. Yami launches an installed Chromium browser (Helium, Chrome, Edge or Brave) with a dedicated Yami profile folder and local-only CDP. Real logins then work in a real browser that Yami can drive. Recent Chrome versions refuse remote debugging on the default profile, so a separate profile is required anyway (**verify**).

**10c. Agent control (Browser MCP).**
- Added to the Phase 2f Yami MCP server:
  - `browser_open`, `navigate`, `search`
  - `read_page` (Readability text and links)
  - `snapshot` (accessibility tree with element refs), `click` and `type` by ref
  - `screenshot`, `wait_for`
- **Driver:** CDP over `webContents.debugger` for the built-in browser, and the same CDP calls for Linked mode. Load `playwright-core` only if raw CDP proves insufficient.
- **Guardrails:**
  - a visible "Yami is driving" bar with a Stop button
  - agents use a separate *agent* partition unless the user lends a logged-in profile per session
  - per-domain allow list
  - confirmation before submit, purchase, post or download
  - agents can never read password fields, cookies or vault entries
  - Yami's own Gemini chat gets the same tools under the existing confirmation policy

**10d. Vault** (`electron/vault/`):
- **Storage:** local only. AES-256-GCM, with the key wrapped by DPAPI (existing `safeStorage` in `electron/store.ts`) and an optional master password (Node `scrypt`). Auto-locks after inactivity.
- **Imports:**
  - **Bookmarks:** the Chromium-family `Bookmarks` JSON (Chrome, Edge, Brave, Helium, Vivaldi) and Firefox `places.sqlite`.
  - **History:** the same, read from a temporary copy because the live files are locked.
  - **Passwords:** only from a CSV the user exports themselves (`chrome://password-manager`, Firefox, Bitwarden). The CSV is deleted after import, with a prompt. Yami will **not** decrypt other browsers' password or cookie stores. Chrome's app-bound encryption exists to stop exactly that infostealer behaviour, and it would be a security liability.
- **Use:** autofill in the Yami Browser needs a user gesture each time. Export back to CSV.
- **Measure:** a browser window with one tab, against the active ceiling. Discarded tabs must return memory.

---

## Documentation (first step, then every phase)

- Save this plan as `Documentation/research/expansion-plan-2026-10-27.md`, with sources, licences and verify-gaps. Register it in `Documentation/docs-manifest.json` and link it from `roadmap.md`.
- Each phase updates:
  - `features-and-settings.md`, `architecture.md` (modules and intervals)
  - `performance.md` (measured before and after), `security-and-providers.md` (new data flows and admin actions)
  - `adaptation.md` records for WinUtil, Orca, Filee, Tangerine, Terax and ascii-reveal
  - `assets-and-licenses.md`, the Yami skill (project map, module rules)
- Then run `npm run docs`.

## Verification (each phase)

- `npm run check` (lines, typecheck, native build, tests, and the new `check:ui`) and `npm run build`.
- Setup and packs: fixture tests for choosing presets and for install, disable and remove, with a corrupted-hash download that must fail closed. Removing a module keeps its data.
- Browser: tab discard and restore, the agent partition being isolated from the user partition, guardrail confirmations, bookmark/history import from fixture files, and the vault's encrypt, lock and unlock round trip.
- Pure logic gets `tests/*.test.mjs`: the module registry, tweak catalogue apply/revert planning, feed parsing and caching, agent detection rules, island cycling priority, worktree command plans and secret masking.
- Browser preview (`npm run preview:web`) with fixture stubs in `src/preview/bridge.ts` for every new method. Check new screens at 1160×790 and 850×610 with reduced motion on and off; run `node scripts/verify-preview.mjs`.
- On Windows:
  - `npm run dev`
  - `node scripts/verify-workbench.mjs` for terminal and agents
  - a synthetic WAV through Whistle (extend `scripts/verify-offline-speech.ps1`)
  - Tune apply/undo only on reversible HKCU tweaks; no disruptive power or network actions purely for coverage
- Package, then run `node scripts/verify-packaged.mjs` and `node scripts/measure-performance.mjs --packaged`, with every module off and then each module on. Record the numbers in `performance.md`.

## Open verification gaps (to be resolved inside the phases)

- Whistle: `needle.exe` stdin streaming, the keyword flag, RAM use.
- Executable names, hook support and the Pi extension path for each agent CLI.
- WinUtil licence; AdGuard Home API; RustDesk config path; Mailpit licence and checksum.
- Whether Reddit RSS stays public; Outlook IMAP OAuth; the audio output-switch API; the Windhawk mod listing.
- The memory effect of destroying the main window.
- Browser: Google sign-in inside Electron, WebAuthn and passkeys, the ad-block library and its licence, the Chrome remote-debugging profile rule, and CDP behaviour for each Linked browser.
- Packs: an NSIS per-user build beside the portable one; resumable downloads behind proxies.
