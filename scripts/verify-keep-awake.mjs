// Desktop check for Keep awake: switches it on (PC, then PC and screen) and
// off through the request the Controls card uses, and asks Electron whether
// a power-save request is held each time. Isolated profile. Nothing is left
// running: quitting Yami ends any request.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/awake-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await new Promise((r) => setTimeout(r, 100));
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  // Request ids start at 0; count the ones Electron still holds.
  const held = () =>
    app.evaluate(
      ({ powerSaveBlocker }) =>
        [...Array(20).keys()].filter((id) => powerSaveBlocker.isStarted(id))
          .length,
    );
  assert.equal(await held(), 0);
  let s = await call("awake.set", { minutes: 0 });
  assert.equal(s.on, true);
  assert.equal(await held(), 1);
  s = await call("awake.set", { minutes: 30, screen: true });
  assert.ok(s.until > Date.now());
  assert.equal(await held(), 1, "switching modes keeps one request");
  s = await call("awake.stop");
  assert.equal(s.on, false);
  assert.equal(await held(), 0, "released");
  await assert.rejects(call("awake.set", { minutes: 5 }), /how long/);
  console.log(JSON.stringify({ passed: true }));
} finally {
  await app.close();
}
