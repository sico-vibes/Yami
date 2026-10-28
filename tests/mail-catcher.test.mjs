import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  MailCatcher,
  mailpitArgs,
} from "../electron/workbench/mail-catcher.ts";
import { engines } from "../electron/wheel/engine-catalog.ts";

/** A stand-in child process that stays up, or exits at once like a port clash. */
function fakeSpawn(exitAt) {
  const calls = [];
  const spawnImpl = (exe, args) => {
    const child = new EventEmitter();
    child.exitCode = null;
    child.kill = () => {
      child.exitCode = 0;
      child.emit("exit", 0);
    };
    calls.push({ exe, args });
    if (exitAt !== undefined)
      setTimeout(() => {
        child.exitCode = exitAt;
        child.emit("exit", exitAt);
      }, 10);
    return child;
  };
  return { spawnImpl, calls };
}

test("Mailpit listens on this PC only and is pinned like the other packs", () => {
  const args = mailpitArgs("C:\\data\\mailpit.db");
  assert.equal(args[args.indexOf("--listen") + 1], "127.0.0.1:8025");
  assert.equal(args[args.indexOf("--smtp") + 1], "127.0.0.1:1025");
  assert.ok(args.includes("--disable-version-check"));
  const pin = engines.find((e) => e.id === "mailpit");
  assert.match(pin.sha256, /^[0-9a-f]{64}$/);
  assert.match(pin.url, /\/v1\.31\.5\/mailpit-windows-amd64\.zip$/);
});

test("the mail catcher needs the pack, reports a port clash and stops", async () => {
  const none = new MailCatcher({ exe: async () => "", dataDir: "C:\\d" });
  assert.equal((await none.status()).installed, false);
  await assert.rejects(none.start(), /Download the Mailpit pack/);
  const clash = fakeSpawn(1);
  const busy = new MailCatcher({
    exe: async () => "C:\\engines\\mailpit.exe",
    dataDir: "C:\\d",
    spawnImpl: clash.spawnImpl,
  });
  await assert.rejects(busy.start(), /port 1025 or 8025/);
  assert.equal(busy.running(), false);
  const ok = fakeSpawn();
  const catcher = new MailCatcher({
    exe: async () => "C:\\engines\\mailpit.exe",
    dataDir: "C:\\d",
    spawnImpl: ok.spawnImpl,
  });
  const started = await catcher.start();
  assert.equal(started.running, true);
  assert.equal(started.web, "http://127.0.0.1:8025");
  await catcher.start();
  assert.equal(ok.calls.length, 1, "a second start reuses the running one");
  assert.equal((await catcher.stop()).running, false);
});
