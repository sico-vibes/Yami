// Desktop check for Yami's logs. Isolated profile; nothing outside it is
// touched. Checks the start entry, a page error reaching ERR with a triage
// entry, a refused request staying in LOG, debug logging switching on and
// off, and a collected report (not shown in Explorer).
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/logs-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const logs = path.join(profile, "logs");
const read = (ch) => {
  const f = fs.readdirSync(logs).find((n) => n.endsWith("." + ch));
  return f ? fs.readFileSync(path.join(logs, f), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
};
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (m, a) => main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  await wait(500);
  assert.ok(read("LOG").some((e) => e.msg === "Yami started"), "the start is logged");

  // An error thrown in a page reaches ERR, with a triage entry.
  await main.evaluate(() => setTimeout(() => { throw new TypeError("verify-logs page error"); }));
  await wait(800);
  const err = read("ERR").find((e) => e.msg === "verify-logs page error");
  assert.ok(err, "the page error is in ERR");
  assert.equal(err.area, "page");
  assert.equal(err.data.window, "main");
  const trg = read("TRG").find((e) => e.msg === "verify-logs page error");
  assert.ok(trg && trg.data.id && trg.data.count === 1, "and in TRG");
  assert.ok(Array.isArray(trg.data.context.modulesOn));

  // A refused request is a LOG line, not an error.
  await call("open.external", { url: "file:///C:/" }).catch(() => {});
  await wait(300);
  assert.ok(read("LOG").some((e) => e.msg === "open.external failed"));
  assert.ok(!read("ERR").some((e) => /HTTP and HTTPS/.test(e.msg)));

  // Debug logging.
  await call("state");
  await wait(200);
  assert.equal(read("DEG").length, 0, "no debug lines while off");
  await call("settings", { debugLogging: true });
  await call("state");
  await wait(300);
  assert.ok(read("DEG").some((e) => e.msg === "state"), "requests are timed while on");
  await call("settings", { debugLogging: false });

  // A secret in a message is masked.
  await main.evaluate(() =>
    window.yami.invoke("log.report", { message: "key AIzaSyD0notreal0123456789abcdefghijklmn", stack: "" }),
  );
  await wait(300);
  assert.ok(!JSON.stringify(read("ERR")).includes("0123456789abcdefghijklmn"), "the key is masked");

  const { file } = await call("log.collect", { note: "verify-logs", reveal: false });
  const text = fs.readFileSync(file, "utf8");
  for (const part of ["## system", "## problems", "## errors", "## log", "verify-logs page error", "## settings"])
    assert.ok(text.includes(part), "the report has " + part);
  assert.ok((await call("log.read", { channel: "ERR", limit: 5 })).length >= 1);
  console.log(JSON.stringify({ passed: true, report: path.basename(file), sizeKB: Math.round(text.length / 1024) }));
} finally {
  await app.close();
}
