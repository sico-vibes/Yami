import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrowserLink } from "../electron/downloads/link.ts";
import { freePort } from "./free-port.mjs";

test("the browser link takes downloads only with its key, and only while on", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-link-"));
  const added = [];
  const port = await freePort();
  const link = new BrowserLink(
    dir,
    path.resolve("extension"),
    (url, name) => added.push([url, name]),
    port,
  );
  const base = `http://127.0.0.1:${port}`;
  await assert.rejects(fetch(`${base}/ping`), "nothing listens while off");
  let s = await link.set(true);
  assert.equal(s.running, true);
  assert.ok(s.prepared, "the extension folder was prepared");
  const { token } = JSON.parse(
    fs.readFileSync(path.join(link.folder(), "yami-link.json"), "utf8"),
  );
  assert.ok(token.length >= 30);
  assert.ok(fs.existsSync(path.join(link.folder(), "manifest.json")));
  assert.equal((await fetch(`${base}/ping`)).status, 401);
  assert.equal(
    (await fetch(`${base}/ping`, { headers: { authorization: "Bearer nope" } }))
      .status,
    401,
  );
  const auth = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  assert.equal((await fetch(`${base}/ping`, { headers: auth })).status, 200);
  const post = (body) =>
    fetch(`${base}/download`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await post({
        url: "https://example.com/a.zip",
        filename: "C:/x/../a.zip",
      })
    ).status,
    200,
  );
  assert.equal((await post({ url: "file:///C:/Windows/win.ini" })).status, 400);
  assert.equal((await post({ url: "javascript:alert(1)" })).status, 400);
  assert.deepEqual(added, [["https://example.com/a.zip", "a.zip"]]);
  // The key survives a restart; the link comes back on by itself.
  await link.close();
  const again = new BrowserLink(dir, path.resolve("extension"), () => {}, port);
  await again.resume();
  assert.equal((await fetch(`${base}/ping`, { headers: auth })).status, 200);
  s = await again.set(false);
  assert.equal(s.running, false);
  await assert.rejects(fetch(`${base}/ping`, { headers: auth }));
  fs.rmSync(dir, { recursive: true, force: true });
});
