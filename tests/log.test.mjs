import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogCore } from "../electron/log/core.ts";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "yami-log-"));
const lines = (file) =>
  fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

test("lines are JSON per channel and day, with secrets and the home folder masked", async () => {
  const dir = temp();
  const home = path.join("C:", "Users", "Someone");
  const log = createLogCore({
    dir,
    home,
    version: "9.9.9",
    now: () => new Date("2026-10-30T10:00:00Z"),
  });
  log.info("app", "Opened " + path.join(home, "notes.txt"), {
    apiKey: "AIzaSyD0notreal0123456789abcdefghijklmn",
    detail: "token sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789",
  });
  await log.flush();
  const [e] = lines(path.join(dir, "2026-10-30.LOG"));
  assert.equal(e.ch, "LOG");
  assert.equal(e.area, "app");
  assert.ok(e.msg.startsWith("Opened ~"), e.msg);
  assert.equal(e.data.apiKey, "[hidden]");
  assert.ok(!e.data.detail.includes("abcdefghijklmnop"), e.data.detail);
});

test("debug lines are written only while debug logging is on", async () => {
  const dir = temp();
  let on = false;
  const log = createLogCore({
    dir,
    version: "1",
    debug: () => on,
    now: () => new Date("2026-10-30T10:00:00Z"),
  });
  log.debugLog("request", "state", { ms: 1 });
  on = true;
  log.debugLog("request", "media", { ms: 2 });
  await log.flush();
  const deg = lines(path.join(dir, "2026-10-30.DEG"));
  assert.deepEqual(
    deg.map((e) => e.msg),
    ["media"],
  );
});

test("triage notes a problem the 1st and 10th time, with what led up to it", async () => {
  const dir = temp();
  const log = createLogCore({
    dir,
    version: "1",
    context: () => ({ modulesOn: ["tune"] }),
    now: () => new Date("2026-10-30T10:00:00Z"),
  });
  log.info("app", "before the problem");
  let id;
  for (let i = 0; i < 12; i++)
    id = log.error("native", new Error(`Windows did not respond to call ${i}`));
  await log.flush();
  const trg = lines(path.join(dir, "2026-10-30.TRG"));
  assert.deepEqual(
    trg.map((e) => e.data.count),
    [1, 10],
  );
  assert.equal(
    trg[0].data.id,
    id,
    "numbers in the message do not split the problem",
  );
  assert.deepEqual(trg[0].data.context, { modulesOn: ["tune"] });
  assert.ok(trg[0].data.before.some((e) => e.msg === "before the problem"));
  assert.equal(lines(path.join(dir, "2026-10-30.ERR")).length, 12);
  assert.equal(log.problems()[0].count, 12);
});

test("a collected report has the problems, errors and log, and old day files go", async () => {
  const dir = temp();
  fs.writeFileSync(path.join(dir, "2026-10-01.LOG"), "{}\n");
  let now = new Date("2026-10-30T10:00:00Z");
  const log = createLogCore({ dir, version: "1.2.3", now: () => now });
  log.info("app", "Yami started");
  log.error("page", new TypeError("x is undefined"));
  await log.flush();
  assert.ok(
    !fs.existsSync(path.join(dir, "2026-10-01.LOG")),
    "a month-old file was removed",
  );
  const file = log.collect({
    note: "It broke when I opened Tune",
    system: { windows: "10.0" },
  });
  assert.match(path.basename(file), /^yami-report-.*\.CLT\.md$/);
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /## What the user said\n\nIt broke when I opened Tune/);
  assert.match(text, /"version": "1\.2\.3"/);
  assert.match(text, /x is undefined/);
  assert.match(text, /Yami started/);
  assert.deepEqual(
    log.read("ERR", 10).map((e) => e.msg),
    ["x is undefined"],
  );
  now = new Date("2026-10-30T11:00:00Z");
  assert.deepEqual(
    log.read("LOG", 10, "2026-10-30T10:30:00Z"),
    [],
    "since skips older entries",
  );
});
