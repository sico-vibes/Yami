import { _electron } from "playwright";
import { skipSetup } from "./test-profile.mjs";
import { spawn } from "node:child_process";
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { nativeHostPath } from "../electron/native-path.ts";
const host = spawn(nativeHostPath(path.resolve("native/bin")), [], {
  windowsHide: true,
});
const pending = new Map();
let id = 0;
const reader = readline.createInterface({ input: host.stdout });
reader.on("line", (line) => {
  const r = JSON.parse(line),
    p = pending.get(r.id);
  if (p) {
    pending.delete(r.id);
    r.error ? p.reject(new Error(r.error)) : p.resolve(r.result);
  }
});
const native = (method, args = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    host.stdin.write(JSON.stringify({ id: n, method, args }) + "\n");
  });
const env = {
  ...process.env,
  YAMI_DATA_DIR: path.resolve(".artifacts/packaged-check-" + Date.now()),
};
delete env.ELECTRON_RUN_AS_NODE;
skipSetup(env.YAMI_DATA_DIR);
let app, original, backup;
try {
  await native("configure", { hotkeys: false });
  original = await native("wallpaperGet");
  backup = fs.readFileSync(original);
  app = await _electron.launch({
    executablePath: path.resolve(
      process.env.YAMI_PACKAGE_DIR || "release",
      "win-unpacked/Yami.exe",
    ),
    args: [],
    env,
  });
  await app.firstWindow();
  let page;
  for (let i = 0; i < 100; i++) {
    page = app.windows().find((p) => p.url().includes("window=main"));
    if (page) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.waitForSelector(".bottom-dock");
  const call = (m, a) =>
    page.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  await call("settings", { clipboardEnabled: false, reducedMotion: true });
  assert.equal((await call("diagnostics")).native.ok, true);
  const state = await call("state");
  assert.equal(state.wallpapers.length, 10);
  assert.ok(
    state.wallpapers.every((p) => !p.includes("app.asar") && fs.existsSync(p)),
  );
  await call("wallpapers.apply", { path: state.wallpapers[0] });
  assert.equal(
    (await native("wallpaperGet")).toLowerCase(),
    state.wallpapers[0].toLowerCase(),
  );
  assert.ok((await call("metrics")).memory.total > 0);
  const encrypted = await app.evaluate(({ safeStorage }) => {
    const text = "Yami encryption verification";
    const bytes = safeStorage.encryptString(text);
    return {
      roundTrip: safeStorage.decryptString(bytes) === text,
      plaintext: bytes.includes(Buffer.from(text)),
    };
  });
  assert.equal(encrypted.roundTrip, true);
  assert.equal(encrypted.plaintext, false);
  const alpha = await app.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes("window=island"),
    );
    return (await window.webContents.capturePage()).toBitmap()[3];
  });
  assert.equal(alpha, 0, "The island must preserve alpha outside its notch");
  console.log(
    "PASS: packaged app, bundled native host, external wallpaper resources, actual wallpaper application, metrics, DPAPI encryption and transparent island.",
  );
  fs.writeFileSync(
    ".artifacts/packaged-results.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "startup",
          "native host",
          "wallpaper resources",
          "wallpaper apply",
          "real metrics",
          "DPAPI",
          "transparent island",
        ],
        providers:
          "not exercised by this isolated packaging test; live evidence is in live-provider-results.json",
      },
      null,
      2,
    ),
  );
} finally {
  await app?.close();
  if (original && backup) {
    fs.writeFileSync(original, backup);
    await native("wallpaperSet", { path: original });
    console.log("Original wallpaper restored.");
  }
  host.kill();
  reader.close();
}
