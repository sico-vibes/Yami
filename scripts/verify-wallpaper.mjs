import { spawn } from "node:child_process";
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const host = spawn(path.resolve("native/bin/Yami.Native.exe"), [], {
  windowsHide: true,
});
let id = 0;
const pending = new Map();
const reader = readline.createInterface({ input: host.stdout });
reader.on("line", (l) => {
  const r = JSON.parse(l),
    p = pending.get(r.id);
  if (p) {
    pending.delete(r.id);
    r.error ? p.reject(new Error(r.error)) : p.resolve(r.result);
  }
});
const call = (method, args = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    host.stdin.write(JSON.stringify({ id: n, method, args }) + "\n");
  });
let original, backup;
try {
  await call("configure", { hotkeys: false });
  original = await call("wallpaperGet");
  assert.ok(original && fs.existsSync(original));
  backup = fs.readFileSync(original);
  const candidate = path.resolve("public/wallpapers/starter-01.jpg");
  await call("wallpaperSet", { path: candidate });
  assert.equal(
    (await call("wallpaperGet")).toLowerCase(),
    candidate.toLowerCase(),
  );
  console.log(
    "PASS: Windows accepted the wallpaper and reported the selected path.",
  );
} finally {
  if (original && backup) {
    fs.writeFileSync(original, backup);
    await call("wallpaperSet", { path: original });
    console.log("Original wallpaper restored.");
  }
  host.kill();
  reader.close();
}
