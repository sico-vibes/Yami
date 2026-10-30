// Live desktop check for accent characters and quick look with the owner's
// own key presses: nothing is injected, so Yami's keyboard hook sees real
// keys exactly as in use. Asks the owner first. Isolated profile, started
// hidden; your own Yami keeps running (its accent and quick look are off by
// default, so only the test copy answers).
// - Accent characters: a text box asks you to hold E, press Space twice and
//   let go; it must end up holding one of e's accents (è for two presses).
// - Quick look: a new File Explorer window on a throwaway folder, with a test
//   file selected, asks for Ctrl+Space; Yami's preview must open. The Explorer
//   window is closed afterwards.
// Usage: node scripts/verify-keys-live.mjs   (each step waits up to 90 s)
import { _electron } from "playwright";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const exec = promisify(execFile);
const ps = (args) =>
  exec(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args],
    {
      windowsHide: true,
      timeout: 30000,
    },
  ).then((r) => r.stdout.trim());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = path.resolve(".artifacts/keys-live-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(
  path.join(profile, "data.json"),
  JSON.stringify({
    settings: {
      setupDone: true,
      startHidden: true,
      quickAccent: true,
      quickLook: true,
    },
  }),
);
// The text box writes what it holds to a file on every change.
const typedFile = path.join(profile, "typed.txt");
const formScript = path.join(profile, "form.ps1");
const q = (s) => s.replace(/'/g, "''");
fs.writeFileSync(
  formScript,
  [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$f = New-Object Windows.Forms.Form; $f.Text = 'Yami key check'; $f.Width = 560; $f.Height = 240; $f.StartPosition = 'CenterScreen'; $f.TopMost = $true",
    "$l = New-Object Windows.Forms.Label; $l.Dock = 'Top'; $l.Height = 70; $l.Padding = '10,10,10,0'",
    "$l.Text = 'Click in the box below. Hold the E key, press Space twice while holding it, then let go of E. The box should show è.'",
    "$t = New-Object Windows.Forms.TextBox; $t.Dock = 'Fill'; $t.Multiline = $true; $t.Font = New-Object Drawing.Font('Segoe UI', 20)",
    "$f.Controls.Add($t); $f.Controls.Add($l)",
    `$t.Add_TextChanged({ [IO.File]::WriteAllText('${q(typedFile)}', $t.Text) })`,
    "$f.Add_Shown({ $f.Activate(); $t.Focus() })",
    "[void]$f.ShowDialog()",
  ].join("\r\n"),
  // PowerShell 5 reads a BOM-less script as ANSI; the BOM keeps "è" intact.
  { encoding: "utf8" },
);
fs.writeFileSync(formScript, "﻿" + fs.readFileSync(formScript, "utf8"));
const files = path.join(profile, "files");
fs.mkdirSync(files, { recursive: true });
const note = path.join(files, "Press Ctrl+Space here.txt");
fs.writeFileSync(note, "Quick look from a real Ctrl+Space.");
const sameFolder = `Where-Object { try { $_.Document.Folder.Self.Path -eq '${q(files)}' } catch { $false } }`;

const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
let form,
  explorerOpen = false;
const result = {};
try {
  let island;
  for (let i = 0; i < 150 && !island; i++) {
    island = app.windows().find((p) => p.url().includes("window=island"));
    if (!island) await wait(100);
  }
  assert.ok(island, "the test copy started");
  // Every window Yami opens from now on, seen from the main process.
  await app.evaluate(({ app }) => {
    globalThis.yamiSeen = [];
    app.on("web-contents-created", (_e, contents) =>
      contents.on("did-start-loading", () =>
        globalThis.yamiSeen.push(contents.getURL()),
      ),
    );
  });
  const seen = (mode) =>
    app.evaluate(
      (_e, m) => globalThis.yamiSeen.some((u) => u.includes(`window=${m}`)),
      mode,
    );
  console.log("1/3 Yami test copy started.");
  await wait(2500);
  const state = await island.evaluate(() => window.yami.invoke("state"));
  assert.ok(state.settings.quickAccent && state.settings.quickLook);

  // Accent characters: wait for the owner's keys (skip with --peek-only).
  if (!process.argv.includes("--peek-only")) {
    form = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", formScript],
      {
        stdio: "ignore",
      },
    );
    const read = () =>
      fs.existsSync(typedFile) ? fs.readFileSync(typedFile, "utf8") : "";
    for (let i = 0; i < 180 && !/[^\x00-\x7f]/.test(read()); i++)
      await wait(500);
    await wait(600);
    result.typed = read();
    result.strip =
      (await seen("accent")) ||
      app.windows().some((p) => p.url().includes("window=accent"));
    console.log(
      `2/3 Accent: the box holds ${JSON.stringify(result.typed)}, strip shown: ${result.strip}.`,
    );
    // Space moves along the strip (é è ê ë …), and a held Space repeats,
    // so any of e's accents is a pass; a plain "e" left behind is not.
    assert.match(
      result.typed.trim(),
      /^[éèêëēęě€]$/,
      "the held e became an accent",
    );
    assert.ok(result.strip, "the accent strip showed while choosing");
    form.kill();
    form = undefined;
  }

  // Quick look: wait for the owner's Ctrl+Space.
  // Explorer wants /select,"path" exactly; Node would quote the whole argument.
  spawn("explorer.exe", [`/select,"${note}"`], {
    detached: true,
    stdio: "ignore",
    windowsVerbatimArguments: true,
  }).unref();
  // Closed at the end, whether it opened as its own window or as a tab.
  explorerOpen = true;
  let preview;
  for (let i = 0; i < 180 && !preview; i++) {
    preview = app
      .windows()
      .find((p) => /^data:text\/html|keys-live/.test(p.url()));
    if (!preview) await wait(500);
  }
  console.log(`3/3 Quick look: preview opened: ${!!preview}.`);
  assert.ok(preview, "Yami's preview opened");
  await preview.waitForLoadState();
  result.previewText = ((await preview.locator("body").textContent()) || "")
    .trim()
    .slice(0, 60);
  assert.match(result.previewText, /Quick look from a real Ctrl\+Space/);
  console.log(JSON.stringify({ passed: true, ...result }));
} finally {
  form?.kill();
  if (explorerOpen)
    await ps([
      "-Command",
      `(New-Object -ComObject Shell.Application).Windows() | ${sameFolder} | ForEach-Object { $_.Quit() }`,
    ]).catch(() => {});
  await app.close();
  if (!result.previewText) console.log(JSON.stringify(result));
}
