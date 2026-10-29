import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileName, freeName, split } from "../electron/downloads/engine.ts";
import { DownloadManager } from "../electron/downloads/manager.ts";

test("names are safe and never overwrite; parts cover the file", () => {
  assert.equal(fileName("https://x/a/b/My%20File.zip"), "My File.zip");
  assert.equal(
    fileName("https://x/dl", 'attachment; filename="re:port?.pdf"'),
    "re_port_.pdf",
  );
  assert.equal(
    fileName("https://x/dl", "attachment; filename*=UTF-8''caf%C3%A9.txt"),
    "café.txt",
  );
  assert.equal(fileName("https://x/"), "download");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-dl-name-"));
  fs.writeFileSync(path.join(dir, "a.zip"), "");
  assert.equal(freeName(dir, "a.zip"), "a (2).zip");
  const parts = split(10 * 1024 * 1024 + 5, 4);
  assert.equal(parts.length, 4);
  assert.equal(parts[0].start, 0);
  assert.equal(parts.at(-1).end, 10 * 1024 * 1024 + 4);
  for (let i = 1; i < parts.length; i++)
    assert.equal(parts[i].start, parts[i - 1].end + 1);
  assert.equal(split(100, 8).length, 1, "small files are one part");
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A server with byte ranges that sends slowly, so pausing can happen mid-way. */
function server(body, { ranges = true, slow = 0 } = {}) {
  const seen = [];
  const s = http.createServer(async (req, res) => {
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
    seen.push(req.headers.range || "");
    let start = 0,
      end = body.length - 1;
    if (ranges && range) {
      start = Number(range[1]);
      end = range[2] ? Number(range[2]) : end;
      res.writeHead(206, {
        "content-range": `bytes ${start}-${end}/${body.length}`,
        "content-length": end - start + 1,
        "content-disposition": 'attachment; filename="data.bin"',
      });
    } else res.writeHead(200, { "content-length": body.length });
    for (let at = start; at <= end; at += 65536) {
      if (!res.writable) return;
      res.write(body.subarray(at, Math.min(end + 1, at + 65536)));
      if (slow) await new Promise((r) => setTimeout(r, slow));
    }
    res.end();
  });
  s.keepAliveTimeout = 1;
  return new Promise((r) =>
    s.unref().listen(0, "127.0.0.1", () =>
      r({ s, seen, url: `http://127.0.0.1:${s.address().port}/file` }),
    ),
  );
}
const until = async (check, ms = 8000) => {
  for (let t = 0; t < ms; t += 25) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timed out");
};

test("a ranged file downloads in parts, pauses, resumes after a restart and matches", async () => {
  const body = crypto.randomBytes(6 * 1024 * 1024 + 123);
  const { s, seen, url } = await server(body, { slow: 15 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-dl-"));
  const file = path.join(dir, "downloads.json");
  let m = new DownloadManager(file, dir, () => {});
  const job = m.add(url);
  await until(() => job.received > 512 * 1024);
  m.pause(job.id);
  await until(() => job.state === "paused" && !m["running"].size);
  assert.equal(job.parts.length, 4, "four connections");
  assert.ok(
    seen.filter((r) => r.startsWith("bytes=") && r !== "bytes=0-0").length >= 4,
  );
  const halfway = job.received;
  assert.ok(halfway > 0 && halfway < body.length);
  m.dispose();
  // A new start: the paused job comes back and resumes from its parts.
  m = new DownloadManager(file, dir, () => {});
  const again = m.list().jobs[0];
  assert.equal(again.state, "paused");
  seen.length = 0;
  m.resume(again.id);
  await until(() => m.list().jobs[0].state === "done", 20000);
  const done = m.list().jobs[0];
  assert.equal(done.name, "data.bin");
  assert.ok(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(done.file))
      .digest("hex") === crypto.createHash("sha256").update(body).digest("hex"),
    "same bytes",
  );
  assert.ok(
    seen.every(
      (r) =>
        !r.startsWith("bytes=0-") ||
        r === "bytes=0-0" ||
        Number(/bytes=(\d+)/.exec(r)[1]) > 0,
    ),
    "resumed, not restarted",
  );
  assert.ok(!fs.existsSync(done.file + ".yamipart"));
  m.dispose();
  s.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a server without ranges gets one stream; bad links are refused", async () => {
  const body = crypto.randomBytes(300 * 1024);
  const { s, url } = await server(body, { ranges: false });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-dl-plain-"));
  const m = new DownloadManager(path.join(dir, "d.json"), dir, () => {});
  assert.throws(() => m.add("file:///C:/Windows/win.ini"), /http/);
  assert.throws(() => m.add("https://user:pw@x.example/a"), /http/);
  const job = m.add(url);
  await until(() => job.state === "done");
  assert.equal(job.parts.length, 1);
  assert.equal(fs.readFileSync(job.file).length, body.length);
  m.remove(job.id);
  assert.ok(fs.existsSync(job.file), "removing from the list keeps the file");
  m.dispose();
  s.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
