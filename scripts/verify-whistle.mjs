// Desktop check for Whistle dictation end to end: downloads the pinned
// Needle runner and Whistle model through Yami (about 18 MB from Hugging
// Face), synthesizes a WAV with Windows' own voice (no microphone), dictates
// it into Yami's own chat box (never another app), and checks the words and
// a Your words replacement. The clipboard is put back. Isolated profile.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/whistle-" + Date.now());
skipSetup(profile);
const wav = path.join(profile, "clip.wav");
execFileSync("powershell.exe", [
  "-NoProfile",
  "-Command",
  `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono); $s.SetOutputToWaveFile('${wav.replace(/'/g, "''")}', $f); $s.Speak('Please open the terminal and show me the weather for tomorrow.'); $s.Dispose()`,
]);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const saved = await app.evaluate(({ clipboard }) => clipboard.readText());
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (m, a) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  await call("modules.set", { id: "whistle", enabled: true });
  await call("modules.set", { id: "workbench", enabled: true });
  const started = Date.now();
  await call("packs.install", { id: "needle" });
  await call("packs.install", { id: "whistle" });
  let packs = [];
  for (let i = 0; i < 360; i++) {
    packs = (await call("modules.list")).find((m) => m.id === "whistle").packs;
    if (packs.every((p) => p.state === "installed" || p.state === "failed"))
      break;
    await wait(500);
  }
  assert.deepEqual(
    packs.map((p) => p.state),
    ["installed", "installed"],
    JSON.stringify(packs),
  );
  const downloadMs = Date.now() - started;
  // "tomorrow" becomes "tmrw" through a Your words entry, as a user would set.
  await call("workbench.settings", { dictationEngine: "whistle" });
  await call("speech.rules.save", {
    heard: "tomorrow",
    replacement: "tmrw",
    kind: "word",
  });
  const hwnd = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((b) =>
      b.webContents.getURL().includes("window=main"),
    );
    w.show();
    w.focus();
    return Number(w.getNativeWindowHandle().readBigUInt64LE(0));
  });
  const box = main.getByLabel("Message Yami");
  await box.click();
  await box.fill("");
  const t = Date.now();
  const text = await call("dictation", {
    data: fs.readFileSync(wav).toString("base64"),
    mimeType: "audio/wav",
    target: hwnd,
  });
  const dictateMs = Date.now() - t;
  assert.match(text, /open the terminal/i);
  assert.match(text, /weather/i);
  assert.match(text, /tmrw/i, "the Your words entry applied");
  for (let i = 0; i < 20 && !(await box.inputValue()); i++) await wait(100);
  assert.match(await box.inputValue(), /weather/i, "typed into Yami's own box");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, text, downloadMs, dictateMs }));
} finally {
  await app.evaluate(({ clipboard }, t) => clipboard.writeText(t), saved);
  await app.close();
}
