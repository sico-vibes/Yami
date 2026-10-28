// Desktop check for media-session control without touching your own player:
// a silent page in the Yami Browser registers its own Windows media session
// ("Yami media check"). Actions are sent only while that is the current
// session, and the page reports what it received. Nothing is audible.
import { _electron } from "playwright";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const title = "Yami media check";
const page = `<!doctype html><title>idle</title><body><script>
// Ten seconds of silence as a WAV, looped.
const rate = 8000, seconds = 10, n = rate * seconds, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })));
audio.loop = true;
const show = (s) => (document.title = s + " " + Math.round(audio.currentTime));
navigator.mediaSession.metadata = new MediaMetadata({ title: "${title}", artist: "Yami" });
navigator.mediaSession.setActionHandler("play", () => audio.play());
navigator.mediaSession.setActionHandler("pause", () => audio.pause());
navigator.mediaSession.setActionHandler("nexttrack", () => show("next"));
navigator.mediaSession.setActionHandler("seekto", (d) => { audio.currentTime = d.seekTime; show("seeked"); });
audio.onplay = () => show("playing");
audio.onpause = () => show("paused");
audio.play().catch((e) => (document.title = "blocked " + e.name));
</script></body>`;
const site = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(page);
});
await new Promise((r) => site.listen(47894, "127.0.0.1", r));
const profile = path.resolve(".artifacts/media-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  await call("modules.set", { id: "browser", enabled: true });
  await call("browser.show", { url: "http://127.0.0.1:47894/" });
  const tabTitle = async () => {
    const s = await call("browser.state");
    return s.tabs.find((t) => t.id === s.active)?.title || "";
  };
  for (let i = 0; i < 50 && !/^playing/.test(await tabTitle()); i++)
    await wait(200);
  assert.match(await tabTitle(), /^playing/, "the test page plays");
  // Act only while the current Windows session is the test page.
  let media;
  for (let i = 0; i < 30; i++) {
    const current = await main.evaluate(() => window.yami.invoke("media"));
    if (current.title === title) {
      media = current;
      break;
    }
    await wait(500);
  }
  assert.equal(
    media?.title,
    title,
    "the test page is the current media session",
  );
  const act = async (action, seconds) => {
    const now = await main.evaluate(() => window.yami.invoke("media"));
    assert.equal(now.title, title, "still the test session before " + action);
    return call("media.action", { action, seconds });
  };
  await act("toggle");
  for (let i = 0; i < 20 && !/^paused/.test(await tabTitle()); i++)
    await wait(150);
  assert.match(await tabTitle(), /^paused/, "toggle paused it");
  await act("toggle");
  for (let i = 0; i < 20 && !/^playing/.test(await tabTitle()); i++)
    await wait(150);
  assert.match(await tabTitle(), /^playing/, "toggle played it");
  await act("next");
  for (let i = 0; i < 20 && !/^next/.test(await tabTitle()); i++)
    await wait(150);
  assert.match(await tabTitle(), /^next/, "next reached the page");
  const seek = await act("seek", 6);
  for (let i = 0; i < 20 && !/^seeked/.test(await tabTitle()); i++)
    await wait(150);
  assert.match(await tabTitle(), /^seeked [5-7]$/, "seek moved to 6 s");
  // Per-app volume, on Yami's own audio session only; restored afterwards.
  const ours = new Set(
    await app.evaluate(({ app }) => app.getAppMetrics().map((m) => m.pid)),
  );
  const apps = await call("audio.apps");
  const mine = apps.find((a) => ours.has(a.pid));
  let appVolume = "no session";
  if (mine) {
    try {
      let list = await call("audio.app", { pid: mine.pid, volume: 37 });
      assert.equal(list.find((a) => a.pid === mine.pid).volume, 37);
      list = await call("audio.app", { pid: mine.pid, muted: true });
      assert.equal(list.find((a) => a.pid === mine.pid).muted, true);
      appVolume = "set and read back";
    } finally {
      await call("audio.app", {
        pid: mine.pid,
        volume: mine.volume,
        muted: mine.muted,
      });
    }
  }
  await assert.rejects(call("audio.app", { pid: -1 }), /Choose an app/);
  console.log(
    JSON.stringify({
      passed: true,
      canSeek: seek.canSeek,
      canShuffle: seek.canShuffle,
      canRepeat: seek.canRepeat,
      appVolume,
    }),
  );
} finally {
  await app.close();
  site.close();
}
