// Desktop check for focus sessions: keep awake and site blocking start with
// the focus timer and are undone when it stops, and a block rule you made
// yourself stays. The network shield runs on a spare port (YAMI_SHIELD_PORT),
// so this PC's DNS is never touched. Needs the internet for the block list.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/focus-verify-" + Date.now());
skipSetup(profile);
const env = {
  ...process.env,
  YAMI_DATA_DIR: profile,
  YAMI_SHIELD_PORT: String(26000 + Math.floor(Math.random() * 5000)),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (m, a) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  await call("modules.set", { id: "tune", enabled: true });
  const shield = await call("tune.shield.set", { on: true });
  assert.ok(shield.running, shield.error);
  await call("tune.shield.rule", { domain: "reddit.com", kind: "block" });
  await main.evaluate(() =>
    window.yami.invoke("panel", { open: true, tab: "Today" }),
  );
  const island = app.windows().find((p) => p.url().includes("window=island"));
  await island
    .getByRole("switch", { name: "Keep the PC awake during focus" })
    .click();
  await island
    .getByRole("switch", { name: "Block distracting sites during focus" })
    .click();
  await island.getByRole("button", { name: "1m", exact: true }).click();
  await island.getByRole("button", { name: "Start", exact: true }).click();
  await wait(1500);
  assert.equal((await call("awake")).on, true, "kept awake");
  let rules = (await call("tune.shield")).block;
  assert.ok(
    rules.includes("youtube.com") && rules.includes("x.com"),
    rules.join(),
  );
  await island.getByRole("button", { name: "Stop", exact: true }).click();
  await wait(1500);
  assert.equal((await call("awake")).on, false, "keep awake ended");
  rules = (await call("tune.shield")).block;
  assert.deepEqual(rules, ["reddit.com"], "only your own rule is left");
  await call("tune.shield.set", { on: false });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true }));
} finally {
  await app.close();
}
