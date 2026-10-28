---
name: yami
description: How to develop, extend and ship Yami, the Windows-first desktop voice companion in this repository (Electron + React + a C# native host). Use whenever you change Yami's code, UI, the Yami cat-spirit character, settings, IPC, native actions, docs or packaging, or when the user mentions "the Yami skill". Covers the stack, project map, data flow, design language, performance rules, verification commands and the required documentation update at the end of every task.
---

# Yami development

Yami is a free, MIT-licensed Windows desktop companion: a cat-eared flame spirit
who lives in a notch ("island") at the top of the screen, can roam the desktop,
talks through the user's own Gemini key, dictates, circles things on screen and
runs local Windows utilities. Read this whole file before changing anything,
then open the reference files you need:

- `references/design-language.md` — the Nightglow tokens, component rules,
  layout, motion and the Yami character rules. Read before any UI work.
- `references/recipes.md` — step-by-step recipes (new setting, IPC request,
  window, model tool, skin, utility tab, native call) and known pitfalls.
- `../../../Documentation/adaptation.md` — adaptation rules and the required
  behavior-to-UI mapping. Read before adapting a feature from another project.

`AGENTS.md` at the repo root holds the non-negotiable guardrails. This skill
expands on them; if they ever disagree, `AGENTS.md` wins.

## Ground rules

1. **Preserve user data.** Chats, settings, plans, memories and provider keys
   must survive every update. Renaming a stored value needs a migration in
   `src/migrations.ts` (run from `electron/store.ts`) and a test.
2. **Every authored text file stays at or under 1,000 lines.** Split by
   responsibility before you get close (`npm run check:lines`). `electron/main.ts`
   is about 960 lines: put new main-process features in their own module, and
   move pure helpers to `policy.ts` or another focused module rather than growing it.
3. **Idle comes first.** No polling loops, no animation and no native queries
   when nothing is happening. Animate only for interaction and active work,
   always respect reduced motion, and measure the full process tree when you
   change background behaviour (`Documentation/performance.md`).
4. **Provider calls stay in the main process.** Keys never reach the renderer,
   logs, fixtures, screenshots or docs. Free tiers first; never enable billing
   or add paid dependencies silently.
5. **Yami is original.** It was inspired by Hitodama, but never copy its text,
   assets, branding, prompts or wallpapers. Write Yami's own copy.
6. **Icons are Phosphor** (`<Icon name="..."/>`, `ph-*` classes). The Yami
   character is project-authored SVG in `src/yami/`.
7. **Update the documentation when you finish** (see the last section). A task
   is not done until the docs match the code.
8. **Adapt behavior faithfully; present it as Yami.** Reuse and extend existing
   Yami components, layouts, tokens, hover/focus and motion patterns for new
   tabs, buttons, toggles and other controls. Preserve the source feature's
   backend contracts, state transitions, side effects, errors and end result.
   Document source revision/license, Windows differences and parity checks;
   unresolved functional differences are gaps, not completed adaptations.

## Stack

| Layer           | Technology                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell           | Electron 44 (`electron/`, bundled by esbuild into `dist-electron/main.cjs`)                                                                                  |
| UI              | React 19 + TypeScript 7, Vite 8, plain CSS in `src/styles/` (no CSS framework)                                                                               |
| Fonts and icons | Rubik Variable (`@fontsource-variable/rubik`), Phosphor web icons                                                                                            |
| AI              | `@google/genai` (Gemini text + Live voice), optional Tavily, Wikipedia fallback                                                                              |
| Windows         | `native/Host.cs`, `ProcessJobs.cs` and `Wheel.cs` (file-wheel drag hook), .NET Framework `csc.exe`, content-hashed host selected by `host-manifest.json`; JSON lines, short-lived `Hook.cs` relay for agent hooks, PowerShell helpers and `Speech.ps1` |
| System data     | `systeminformation`, Node `os`                                                                                                                               |
| Tests           | Node test runner (`tests/*.test.mjs`, run with `--experimental-transform-types`), Playwright scripts in `scripts/verify-*.mjs`                               |
| Packaging       | electron-builder, unsigned portable `.exe` in `release/`                                                                                                     |

## Project map

```
electron/        main process
  main.ts          app lifetime, windows, tray, IPC routing, schedules (near 1,000 lines)
  main-window.ts   main window on demand; released a minute after hiding; queued events until `window.ready`
  requests.ts      most IPC request handlers (`window.yami.invoke(method, args)`)
  overlays.ts      roaming "stray" window, caption pill window, tool-activity events
  focus-timer.ts   Today focus countdown        controls.ts  volume/brightness/radios
  metrics.ts       instant Stats with background refresh
  assistant.ts     Gemini chat/Live, model tool declarations, research
  activity.ts      friendly labels for tool calls  policy.ts  permission and URL checks
  store.ts         data.json + DPAPI-encrypted keys  windows.ts  makeWindow factory
  native.ts / platform.ts   native host and PowerShell helpers
  modules/         optional modules: registry.ts (pure, tested), host.ts (lazy build/dispose, modules.* IPC)
  workbench/       AI workspace: sessions/hooks, quota, connections, terminal PTY, local model, MCP, context, speech/notes
  wheel/           file wheel: service window, engine downloads, command plans, PDF/archive/document conversion
  native-path.ts   resolves the content-hashed native host from host-manifest.json
src/             renderer (main.tsx imports only the `?window=` screen)
  App.tsx          main window (Home, Bond = memory, Soul = loadout, Desk = plans, Settings)
  Island.tsx       top-centre notch + drawer (Utilities.tsx tabs, Today.tsx, MediaPeek.tsx)
  Stray.tsx        roaming Yami        Caption.tsx  bottom caption pill
  Lasso.tsx        circle-to-ask       Effects.tsx  ability/wallpaper effects
  Loadout.tsx + LoadoutHub.tsx   loadout catalogue and orbit hub
  yami/            YamiSpirit.tsx (renderer), motion.ts (pure maths), skins.ts, features.ts
  shared.ts        State/Settings types   default-settings.ts   migrations.ts
  modules.ts       module catalogue: settings key, cost, permissions, packs, presets
  setup/           Choose your Yami and Settings › Modules cards
  ui.tsx           Icon, IconButton, Toggle, Modal, useYami, Spirit re-export
  controls.tsx     Select, TooltipLayer, StatusChip, Meter, shortTime/relativeTime
  status-tone.ts   status word → colour family (tested)   island-bounds.ts  island size per tab
  styles/          tokens (Nightglow design tokens), base, controls, home, sidebar-pages,
                   cards, loadout, island, drawer-tabs, overlays, today, responsive, workbench, wheel
  workbench/       lazy AI workspace; TerminalWindow.tsx lazy xterm.js/fit renderer
  wheel/           file-wheel window, tool windows, catalogue, gesture rules (own transparent windows)
  preview/         browser-only fixture bridge for `npm run preview:web`
native/          Host.cs, ProcessJobs.cs, Wheel.cs, Hook.cs, Media.ps1, Radios.ps1, Speech.ps1, ExplorerSelection.ps1, SendToLink.ps1
scripts/         dev, build, docs, icon export, verification and measurement
tests/           unit and native contract tests
Documentation/   full docs (Markdown) + generated viewer `index.html`
```

## How data flows

- **Renderer → main:** `api(method, args)` (in `src/api.ts`) calls
  `window.yami.invoke`. `main.ts` checks the sender is a Yami window, then routes
  `stray.*`/`caption.*` to `overlays.ts`, `timer.*` to `focus-timer.ts`, and
  everything else to `requests.ts`.
- **Main → renderers:** `broadcast(event)` sends `{ type, ... }` to every window
  and lets `overlays.observe` react. Renderers subscribe with `useYami(callback)`.
  State changes go through `changed()`, which saves and broadcasts `state`.
- **Native host:** `native.call(name, args)` sends one JSON line; asynchronous
  events (shortcuts, foreground window, ability clicks) arrive in `nativeEvent`.
- **Windows:** `makeWindow(mode, options)` loads the same bundle with
  `?window=<mode>`; `src/main.tsx` picks the component. Transparent overlays use
  `showInactive`, `focusable: false` and `setIgnoreMouseEvents` so they never
  steal focus.
- **Preview:** `src/preview/bridge.ts` fakes `window.yami` with fixtures. Every
  new request method a screen calls needs a stub there (or in
  `src/preview/overlays.ts`), returning demo data with no OS or network effects.

## Working loop

1. Read the relevant code and docs first (`Documentation/features-and-settings.md`,
   `architecture.md`, `reference/design-system.md`). For new features or direction,
   read `Documentation/reference/product-brief.md` and the ranked ideas in
   `Documentation/research/feature-recommendations-2026-10-18.md` first. Those
   ideas are proposals: check their guardrails (idle cost, off-by-default, preview
   before system changes) and the Windows-API verification gaps before building.
2. Build UI in the browser preview: `npm run preview:web` →
   `http://127.0.0.1:5174/?screen=Home` (screens: Home, Bond, Soul, Desk,
   Settings, Island, Controls, Today, Stats, Clipboard, Apps, Wallpaper, Power,
   Stray, Caption, AI, Terminal, File wheel, Background). The stage alone renders at `?stage=1&screen=<name>`.
3. Run it for real on Windows: `npm run dev` (Vite on 5173 + Electron).
4. Verify (pick what applies, report what you could not run):

| Command                                                                        | When                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `npm run check`                                                                | always: line limit, typecheck, native build, tests                         |
| `npm run build`                                                                | before packaging or any main-process change                                |
| `node scripts/verify-preview.mjs`                                              | renderer changes (needs the preview server; also checks docs viewer)       |
| `node scripts/capture-documentation.mjs`                                       | UI changes that docs screenshots show (isolated profile)                   |
| `npm run package` then `node scripts/verify-packaged.mjs`                      | release builds (verify-packaged briefly applies then restores a wallpaper) |
| `node scripts/measure-performance.mjs --packaged [--no-roam] [--living-flame]` | anything touching idle behaviour                                           |
| `npm run docs`                                                                 | after editing any `Documentation/*.md`                                     |
| `node scripts/verify-workbench.mjs [--packaged]` | native approvals, PTY state, resize, Ctrl+C and owned descendant cleanup using isolated fixtures |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-offline-speech.ps1` | synthetic WAV through installed Windows speech, without microphone/provider |
| `node scripts/capture-workbench.mjs` | synthetic AI/terminal screenshots and supported-width layout checks |

5. Add or update tests for pure logic (`tests/*.test.mjs` can import `.ts`
   files directly). Keep motion and migration logic in pure modules so they are
   testable.

## Building a release

Bump `version` in `package.json` and both top-of-file `"version"` fields in the
compact one-line `package-lock.json`, run `npm run package`, then
`node scripts/verify-packaged.mjs`. Output: `release/Yami <version>.exe`
(portable, unsigned, so SmartScreen may warn). Native builds now select a
content-versioned host with an atomic manifest, leaving running old binaries
untouched. Never close the user's app to replace a host. Keep node-pty unpacked
for its native addon, ConPTY DLLs and worker. Source/unpacked verification can
use `npx electron-builder --win --dir` without publishing or bumping the version.

## Finish: update the documentation (required)

Before you report a task as done:

1. Update every affected page in `Documentation/`:
   `features-and-settings.md` (behaviour, settings table, defaults),
   `architecture.md` (modules, intervals, data flow), `development.md` (commands,
   source map, preview screens), `reference/design-system.md` (visual changes),
   `performance.md` (background work, measurements), `security-and-providers.md`
   (data flow, permissions), `roadmap.md` (move shipped ideas out),
   `assets-and-licenses.md` (new assets). Keep shipped behaviour, proposals,
   measured results and unknowns clearly separate; never claim a measurement
   you did not run.
2. Register any new page in `Documentation/docs-manifest.json`.
3. Run `npm run docs` to regenerate `Documentation/index.html`.
4. Refresh screenshots with `node scripts/capture-documentation.mjs` when the UI
   they show changed.
5. Update this skill (`.claude/skills/yami/`) if you changed the stack, project
   map, workflow or design language, so the next agent starts from the truth.
6. In your final message, list what you verified and what you could not.
