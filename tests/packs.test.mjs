import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PackManager } from "../electron/modules/packs.ts";
import { EngineStore } from "../electron/wheel/engines.ts";

function fakeEngines() {
  const installed = new Set();
  const jobs = new Map();
  return {
    installed,
    jobs,
    list: () =>
      ["ffmpeg", "magick"].map((id) => ({
        id,
        version: "1",
        license: "test",
        installed: installed.has(id),
      })),
    ensure(id, { signal, progress } = {}) {
      return new Promise((resolve, reject) => {
        jobs.set(id, {
          progress,
          finish: () => {
            installed.add(id);
            resolve("exe");
          },
          fail: (message) => reject(new Error(message)),
        });
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    },
    async installFile(id, file) {
      if (file === "bad") throw new Error("did not match its pinned checksum");
      installed.add(id);
    },
    async remove(id) {
      installed.delete(id);
    },
  };
}
const tick = () => new Promise((r) => setImmediate(r));
const state = (manager, id) => manager.list().find((p) => p.id === id);

test("packs download one at a time and report throttled progress", async () => {
  const engines = fakeEngines();
  let changes = 0,
    clock = 1000;
  const manager = new PackManager(engines, () => changes++, () => clock);
  manager.install(["ffmpeg", "magick", "ffmpeg"]);
  await tick();
  assert.equal(state(manager, "ffmpeg").state, "downloading");
  assert.equal(state(manager, "magick").state, "queued");
  assert.equal(engines.jobs.size, 1, "second waits for the first");
  const before = changes;
  engines.jobs.get("ffmpeg").progress(10, 100);
  engines.jobs.get("ffmpeg").progress(20, 100);
  assert.equal(changes, before + 1, "progress within 250 ms is coalesced");
  assert.equal(state(manager, "ffmpeg").received, 20);
  assert.equal(state(manager, "ffmpeg").bytes, 100);
  clock += 300;
  engines.jobs.get("ffmpeg").progress(50, 100);
  assert.equal(changes, before + 2);
  engines.jobs.get("ffmpeg").finish();
  await tick();
  await tick();
  assert.equal(state(manager, "ffmpeg").state, "installed");
  assert.equal(state(manager, "ffmpeg").received, undefined);
  assert.equal(state(manager, "magick").state, "downloading");
  engines.jobs.get("magick").fail("magick download failed (503).");
  await tick();
  await tick();
  assert.equal(state(manager, "magick").state, "failed");
  assert.match(state(manager, "magick").error, /503/);
  manager.install(["ffmpeg"]);
  assert.equal(state(manager, "ffmpeg").state, "installed", "no re-download");
});

test("cancel aborts a download or drops a queued one", async () => {
  const engines = fakeEngines();
  const manager = new PackManager(engines, () => {});
  manager.install(["ffmpeg", "magick"]);
  await tick();
  manager.cancel("magick");
  assert.equal(state(manager, "magick").state, "missing");
  await assert.rejects(manager.remove("ffmpeg"), /Cancel the download/);
  manager.cancel("ffmpeg");
  await tick();
  await tick();
  assert.equal(state(manager, "ffmpeg").state, "missing");
  assert.equal(engines.jobs.size, 1, "the dropped pack never started");
});

test("install from file and remove go through the engine store", async () => {
  const engines = fakeEngines();
  const manager = new PackManager(engines, () => {});
  await assert.rejects(manager.installFile("ffmpeg", "bad"), /checksum/);
  assert.equal(state(manager, "ffmpeg").state, "failed");
  await manager.installFile("ffmpeg", "good");
  assert.equal(state(manager, "ffmpeg").state, "installed");
  await manager.remove("ffmpeg");
  assert.equal(state(manager, "ffmpeg").state, "missing");
});

test("engine store streams progress, shares one download, verifies files", async () => {
  const payload = Buffer.from("MZ-fake");
  const spec = {
    id: "exiftool",
    version: "test",
    license: "test",
    url: "https://example.test/exiftool.exe",
    sha256: createHash("sha256").update(payload).digest("hex"),
    format: "exe",
    exe: "exiftool.exe",
    source: "test",
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-pack-"));
  let fetches = 0;
  const store = new EngineStore(root, [spec], async () => {
    fetches++;
    return new Response(payload, {
      headers: { "content-length": String(payload.length) },
    });
  });
  const seen = [];
  const [a, b] = await Promise.all([
    store.ensure("exiftool", { progress: (r, t) => seen.push([r, t]) }),
    store.ensure("exiftool"),
  ]);
  assert.equal(a, b);
  assert.equal(fetches, 1);
  assert.deepEqual(seen.at(-1), [payload.length, payload.length]);
  await store.remove("exiftool");
  assert.equal(store.list()[0].installed, false);
  const file = path.join(root, "manual.exe");
  fs.writeFileSync(file, "tampered");
  await assert.rejects(store.installFile("exiftool", file), /checksum/);
  assert.equal(store.list()[0].installed, false);
  fs.writeFileSync(file, payload);
  await store.installFile("exiftool", file);
  assert.equal(store.list()[0].installed, true);
});

test("a cancelled engine download writes nothing", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-pack-"));
  const spec = {
    id: "ffmpeg",
    version: "test",
    license: "test",
    url: "https://example.test/ffmpeg.zip",
    sha256: "ab".repeat(32),
    format: "zip",
    exe: "ffmpeg.exe",
    source: "test",
  };
  const store = new EngineStore(root, [spec], (_url, init) => {
    return new Promise((_resolve, reject) =>
      init.signal.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      ),
    );
  });
  const controller = new AbortController();
  const job = store.ensure("ffmpeg", { signal: controller.signal });
  assert.equal(store.busy("ffmpeg"), true);
  controller.abort();
  await assert.rejects(job, /Abort/);
  assert.equal(store.busy("ffmpeg"), false);
  assert.equal(fs.existsSync(path.join(root, "ffmpeg")), false);
});
