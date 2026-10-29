import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CleanupController, nativeStats } from "../electron/tune/cleanup.ts";

const old = new Date(Date.now() - 3 * 24 * 60 * 60_000);
function put(file, bytes, at) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(bytes));
  if (at) fs.utimesSync(file, at, at);
}

test("cleanup measures first, then removes only the chosen areas", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-clean-"));
  const keep = fs.mkdtempSync(path.join(os.tmpdir(), "yami-keep-"));
  try {
    const temp = path.join(root, "Temp");
    put(path.join(temp, "old.tmp"), 1000, old);
    put(path.join(temp, "setup", "old.cab"), 500, old);
    put(path.join(temp, "new.tmp"), 300); // changed today: kept
    fs.mkdirSync(path.join(temp, "fresh-empty")); // new empty folder: kept
    put(path.join(root, "LocalAppData", "D3DSCache", "a", "s.bin"), 2000);
    put(path.join(root, "LocalAppData", "NVIDIA", "DXCache", "n.bin"), 700);
    put(path.join(root, "LocalAppData", "CrashDumps", "app.dmp"), 4000);
    put(path.join(root, "RecycleBin", "$R1.txt"), 50);
    put(path.join(root, "RecycleBin", "desktop.ini"), 10);
    // A link out of the area is never followed.
    put(path.join(keep, "precious.txt"), 99);
    fs.symlinkSync(keep, path.join(temp, "link"), "junction");

    const c = new CleanupController(root);
    const scan = Object.fromEntries(
      (await c.scan()).map((a) => [a.id, [a.bytes, a.files]]),
    );
    assert.deepEqual(scan, {
      temp: [1500, 2],
      shaders: [2700, 2],
      reports: [0, 0],
      dumps: [4000, 1],
      recycle: [50, 1],
    });
    await assert.rejects(c.clean([]), /Choose/);
    const result = await c.clean(["temp", "shaders", "recycle"]);
    assert.deepEqual(result, { freed: 4250, removed: 5, skipped: 0 });
    assert.ok(fs.existsSync(path.join(temp, "new.tmp")));
    assert.ok(fs.existsSync(path.join(temp, "fresh-empty")));
    assert.ok(!fs.existsSync(path.join(temp, "old.tmp")));
    assert.ok(fs.existsSync(path.join(root, "LocalAppData", "D3DSCache")));
    assert.ok(
      !fs.existsSync(path.join(root, "LocalAppData", "D3DSCache", "a")),
    );
    assert.ok(fs.existsSync(path.join(root, "RecycleBin", "desktop.ini")));
    assert.ok(
      fs.existsSync(path.join(root, "LocalAppData", "CrashDumps", "app.dmp")),
    );
    assert.ok(
      fs.existsSync(path.join(keep, "precious.txt")),
      "link not followed",
    );
  } finally {
    try {
      fs.unlinkSync(path.join(root, "Temp", "link"));
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(keep, { recursive: true, force: true });
  }
});

test("the native folder reader agrees with the Node walk", async (t) => {
  const stats = nativeStats(path.resolve("native/bin/Yami.FileStats.exe"));
  if (!stats) return t.skip("run npm run build:native first");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-stats-"));
  try {
    put(path.join(root, "a", "old.bin"), 1200, old);
    put(path.join(root, "a", "b", "older.bin"), 800, old);
    put(path.join(root, "new.bin"), 50);
    put(path.join(root, "desktop.ini"), 7, old);
    assert.deepEqual(await stats([root], 24 * 60 * 60_000, "desktop.ini"), {
      bytes: 2000,
      files: 2,
    });
    assert.deepEqual(await stats([root, path.join(root, "missing")], 0), {
      bytes: 2057,
      files: 4,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
