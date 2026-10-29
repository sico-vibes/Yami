// LIVE, only with the owner's approval: points one real adapter at the
// network shield, checks lookups through Windows' own resolver, then puts
// the adapter back exactly as it was. Two UAC prompts. Needs the internet.
// Usage: node scripts/verify-shield-live.mjs [adapter name]
import { _electron } from "playwright";
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const wanted = process.argv[2];
const profile = path.resolve(".artifacts/shield-live-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.YAMI_SHIELD_PORT;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let call,
  adapter,
  restored = false;
const result = {};
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  await call("modules.set", { id: "tune", enabled: true });
  let status = await call("tune.shield.set", { on: true });
  assert.ok(status.running, status.error || "shield did not start on port 53");
  for (let i = 0; i < 120 && (status.updating || !status.lists[0].rules); i++) {
    await wait(500);
    status = await call("tune.shield");
  }
  assert.ok(status.lists[0].rules > 50000, "list downloaded");
  const adapters = await call("tune.dns");
  adapter = adapters.find((a) => (wanted ? a.name === wanted : true));
  assert.ok(adapter, "no connected adapter");
  result.before = {
    name: adapter.name,
    profile: adapter.profile,
    servers: adapter.servers,
    encrypted: adapter.encrypted,
  };
  // UAC prompt 1.
  const after = await call("tune.dns.set", {
    index: adapter.index,
    profile: "yami",
  });
  const now = after.find((a) => a.index === adapter.index);
  assert.equal(now.profile, "yami", JSON.stringify(now.servers));
  result.during = now.servers;
  await wait(1500);
  const names = fs
    .readFileSync(path.join(profile, "shield", "stevenblack.exact"), "latin1")
    .split("\n");
  const listed = names[Math.floor(names.length / 3)];
  const before = (await call("tune.shield")).stats.queries;
  // Windows' own resolver, the one every app uses.
  const blocked = await dns.lookup(listed, { family: 4 });
  const normal = await dns.lookup("example.com", { family: 4 });
  const counted = (await call("tune.shield")).stats;
  result.lookups = { listed, blocked: blocked.address, normal: normal.address };
  assert.equal(blocked.address, "0.0.0.0", "listed name blocked for every app");
  assert.notEqual(normal.address, "0.0.0.0");
  assert.ok(counted.queries > before, "lookups went through the shield");
  result.page = await (await fetch("https://example.com/")).status;
} catch (error) {
  result.failed = error.message;
} finally {
  if (adapter && call) {
    // UAC prompt 2: back to how it was.
    const back =
      result.before?.profile &&
      !["custom", "yami"].includes(result.before.profile)
        ? result.before.profile
        : "automatic";
    const list = await call("tune.dns.set", {
      index: adapter.index,
      profile: back,
      encrypted: result.before?.encrypted,
    });
    const end = list.find((a) => a.index === adapter.index);
    result.after = {
      profile: end.profile,
      servers: end.servers,
      encrypted: end.encrypted,
    };
    restored = true;
  }
  await call?.("tune.shield.set", { on: false }).catch(() => {});
  await app.close();
}
console.log(JSON.stringify(result));
assert.ok(!result.failed, result.failed);
assert.ok(restored);
assert.deepEqual(
  result.after.servers,
  result.before.servers,
  "servers restored",
);
console.log(JSON.stringify({ passed: true, ...result }));
