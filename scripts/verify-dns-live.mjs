// LIVE check, run only with the owner's approval: switches one adapter to
// Quad9 with DNS over HTTPS through Tune, checks lookups still work, then
// switches it back to Automatic (DHCP). Each change shows a Windows UAC
// prompt that a person must accept. Usage: node scripts/verify-dns-live.mjs
// [adapter name, default Ethernet]. Isolated profile.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const adapterName = process.argv[2] || "Ethernet";
const profile = path.resolve(".artifacts/dns-live-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const resolves = () => {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Resolve-DnsName example.com -Type A -DnsOnly -ErrorAction Stop | Out-Null",
      ],
      { timeout: 20000 },
    );
    return true;
  } catch {
    return false;
  }
};
const steps = {};
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
  const before = (await call("tune.dns")).find((a) => a.name === adapterName);
  assert.ok(before, `No connected adapter named ${adapterName}.`);
  steps.before = { servers: before.servers, encrypted: before.encrypted };
  console.log("Accept the Windows prompt to switch to Quad9 with encryption…");
  const on = (
    await call("tune.dns.set", {
      index: before.index,
      profile: "quad9",
      encrypted: true,
    })
  ).find((a) => a.index === before.index);
  steps.quad9 = {
    profile: on.profile,
    encrypted: on.encrypted,
    resolves: resolves(),
  };
  console.log("Accept the Windows prompt to switch back to Automatic…");
  const back = (
    await call("tune.dns.set", {
      index: before.index,
      profile: "automatic",
      encrypted: false,
    })
  ).find((a) => a.index === before.index);
  steps.after = {
    servers: back.servers,
    encrypted: back.encrypted,
    resolves: resolves(),
  };
  assert.equal(steps.quad9.profile, "quad9");
  assert.equal(steps.quad9.encrypted, true);
  assert.equal(
    steps.quad9.resolves,
    true,
    "lookups worked over DNS over HTTPS",
  );
  assert.deepEqual(
    steps.after.servers,
    steps.before.servers,
    "back to the router's DNS",
  );
  assert.equal(steps.after.encrypted, false);
  assert.equal(steps.after.resolves, true);
  console.log(JSON.stringify({ passed: true, steps }));
} catch (error) {
  console.log(JSON.stringify({ passed: false, steps, error: error.message }));
  process.exitCode = 1;
} finally {
  await app.close();
}
