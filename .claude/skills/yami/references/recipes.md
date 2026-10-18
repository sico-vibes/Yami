# Yami recipes and pitfalls

Each recipe ends with the same duty: update the docs (see SKILL.md, "Finish").

## Adapt an upstream feature

Read `Documentation/adaptation.md` from the repository root. Pin the source
revision and license, define the selected feature's exact functional scope, and
map backend contracts, states, side effects and failures to existing Yami UI
patterns. Implement the operating path behind the existing main/native boundary;
do not simplify functionality to fit the presentation. Verify parity on Windows
and document unresolved platform differences instead of calling them complete.

## Add a setting

1. Add the field to `Settings` in `src/shared.ts` and its default in
   `src/default-settings.ts`. Saved data is merged over defaults in
   `electron/store.ts`, so old users get the default automatically. The
   `settings` request only accepts keys that exist with the same type.
2. Add a row in `src/Settings.tsx` with `row(title, help, toggle(key, label))`
   under the right `.group-title`.
3. If the main process must react, read `store.state.settings.<key>` there (for
   example in `overlays.observe` on `state`, or in the `settings` request).
4. If renderers need it outside React state, mirror it on
   `document.documentElement.dataset` in `useYami` (see `syncFlame` in
   `src/ui.tsx`).
5. Update the settings table in `Documentation/features-and-settings.md`.

## Rename or reshape stored data

Write the conversion in `src/migrations.ts` (`migrateState`), keep it
idempotent, and add a test in `tests/motion.test.mjs` or a new test file that
proves other data (messages, keys) is untouched.

## Add an IPC request

1. Handle `case "feature.action":` in `electron/requests.ts`, or in a focused
   module with `handles(method)`/`invoke(method, args)` routed from the
   `ipcMain.handle("yami:invoke")` block in `main.ts` (like `overlays.ts`,
   `focus-timer.ts`).
2. Validate every argument; renderer input is untrusted. Use `confirm()` for
   anything sensitive.
3. Call it from the renderer with `api("feature.action", args)`.
4. Stub it in `src/preview/bridge.ts` with fixture data and no side effects.

## Add a window or overlay

Create it with `makeWindow("<mode>", options)` from `electron/windows.ts`, add
`mode === "<mode>"` to `src/main.tsx`, make html/body transparent in
`src/styles/overlays.css`, and create it only when needed and close it when idle.
For click-through windows use `setIgnoreMouseEvents(true, { forward: true })`
and toggle on hover from the renderer. Add a preview screen in
`src/preview/bootstrap.tsx` and to `scripts/verify-preview.mjs`.

## Add a model tool

Declare it in `tools` in `electron/assistant.ts`, implement it in the `action`
dispatcher in `main.ts` (or a module it calls), gate risky tools in
`electron/policy.ts`, add a friendly label in `electron/activity.ts` so the
island card can show it, and test the policy in `tests/policy.test.mjs`. The
system prompt forbids purchases and sending messages; keep it that way.

## Add a native (Windows) call

Add a `case "name":` in `native/Host.cs` (keep each case to one line in the
existing style, add `DllImport`s at the top), call it with
`native.call("name", args)`, and `.catch()` failures. Rebuild with
`npm run build:native` (versioned host builds leave running Yami untouched). Test it quickly by
compiling to a scratch path and piping `{"id":1,"method":"name","args":{}}` into
the exe.

## Add a utility tab or island card

Add the tab to `utilityTabs` in `src/Utilities.tsx` (big tabs get their own file,
like `Today.tsx`), give it a width and height in `setPanel` in `main.ts`, style
it in a dedicated CSS file imported from `src/style.css`, and add a preview
screen. Keep polling inside the mounted component only.

## Add a skin

Add colours to `src/yami/skins.ts`, a card to `souls` in `src/Loadout.tsx` with
original copy, its price in the `loadout.equip` catalogue in
`electron/requests.ts` and the preview bridge list, then update the skins table
in the docs.

## Pitfalls seen in this repo

- **Line endings:** files are LF. Python's text mode on Windows writes CRLF;
  open files with `newline=""` or normalise afterwards, then run Prettier on the
  files you touched (some older files are not Prettier-clean; leave them).
- **`ELECTRON_RUN_AS_NODE`:** terminals hosted by Electron apps export it. Launch
  scripts must `delete env.ELECTRON_RUN_AS_NODE` (an empty string still counts).
- **Versioned native host:** resolve `host-manifest.json` with `nativeHostPath` in
  tests/scripts; do not hardcode or replace a running `Yami.Native.exe`.
- **Workspace:** optional features stay off until configured. Use
  `electron/workbench/` controllers and safe `src/preview/workbench.ts` fixtures.
  Never read real account credentials just to test UI. The PTY helper is lazy,
  Job Object-owned and its node-pty files must be unpacked in a package.
- **Background browser tabs pause `requestAnimationFrame`:** if animation tests
  report zero frames, render with headless Playwright (`channel: "msedge"`) or
  test in Electron instead.
- **Promise.all on slow Windows queries** makes screens feel frozen; serve cached
  values and refresh in the background (see `electron/metrics.ts`).
- **Generic hover rules** override filled buttons; give them explicit `:hover`.
- **Single instance:** test runs use `YAMI_DATA_DIR` (isolated profile) so they
  never touch the user's data; always do the same.
- **Never** run real power actions, publish speed tests or use the user's key
  just to prove a screen renders.
