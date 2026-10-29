// Desktop check for Whistle's live caption: Chromium's fake microphone plays
// a sentence synthesized by Windows, dictation starts in the island, and
// the caption window must show words before the recording ends. The
// recording is then cancelled, so nothing is typed anywhere. Run after
// verify-whistle.mjs has downloaded the engine into a profile, or let it
// download (about 18 MB). Isolated profile.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/whistle-live-" + Date.now());
skipSetup(profile);
const wav = path.join(profile, "mic.wav");
execFileSync("powershell.exe", [
  "-NoProfile",
  "-Command",
  `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono); $s.SetOutputToWaveFile('${wav.replace(/'/g, "''")}', $f); $s.Speak('Remind me to water the plants tomorrow morning.'); $s.Dispose()`,
]);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({
  args: [
    path.resolve("."),
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-audio-capture=${wav}`,
  ],
  env,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
  await call("packs.install", { id: "needle" });
  await call("packs.install", { id: "whistle" });
  for (let i = 0; i < 360; i++) {
    const packs = (await call("modules.list")).find(
      (m) => m.id === "whistle",
    ).packs;
    if (packs.every((p) => p.state === "installed")) break;
    await wait(500);
  }
  await call("workbench.settings", { dictationEngine: "whistle" });
  const captions = [];
  await main.exposeFunction("__caption", (t) => captions.push(t));
  await main.evaluate(() =>
    window.yami.on(
      (e) =>
        e.type === "transcript" &&
        e.role === "user" &&
        window.__caption(e.text),
    ),
  );
  // Start dictation in the island the way the shortcut does.
  await app.evaluate(({ BrowserWindow }) => {
    const island = BrowserWindow.getAllWindows().find((b) =>
      b.webContents.getURL().includes("window=island"),
    );
    island.webContents.send("yami:event", {
      type: "dictation-start",
      target: 0,
    });
  });
  for (let i = 0; i < 80 && !captions.some((c) => /plants|water/i.test(c)); i++)
    await wait(250);
  // Cancel, so the final text is never inserted into whatever is in front.
  await app.evaluate(({ BrowserWindow }) => {
    for (const b of BrowserWindow.getAllWindows())
      b.webContents.send("yami:event", { type: "cancel-recording" });
  });
  assert.ok(
    captions.some((c) => /plants|water/i.test(c)),
    "live caption: " + JSON.stringify(captions),
  );
  console.log(JSON.stringify({ passed: true, captions: captions.slice(0, 4) }));
} finally {
  await app.close();
}
