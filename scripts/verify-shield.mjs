// Desktop check for Tune's network shield. Needs the internet: it downloads
// the StevenBlack list and asks Quad9 over DNS over HTTPS. The shield answers
// on a spare port (YAMI_SHIELD_PORT), so this PC's own DNS settings are never
// touched; lookups are sent to it directly.
import { _electron } from "playwright";
import { Resolver } from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/shield-verify-" + Date.now());
skipSetup(profile);
const port = 25000 + Math.floor(Math.random() * 10000);
const env = {
  ...process.env,
  YAMI_DATA_DIR: profile,
  YAMI_SHIELD_PORT: String(port),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const dns = new Resolver({ timeout: 4000, tries: 1 });
dns.setServers([`127.0.0.1:${port}`]);
// Private memory of the main process in MB, as Task Manager counts it.
const mainMemory = () =>
  app.evaluate(async () =>
    Math.round((await process.getProcessMemoryInfo()).private / 1024),
  );
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
  await call("modules.set", { id: "tune", enabled: true });
  const before = await mainMemory();
  await main.getByRole("button", { name: "Tune", exact: true }).click();
  await main.getByRole("switch", { name: "Network shield" }).click();
  let status;
  for (let i = 0; i < 120; i++) {
    status = await call("tune.shield");
    if (!status.updating && status.lists[0].rules) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(status.running, status.error);
  const rules = status.lists[0].rules;
  assert.ok(rules > 50000, `StevenBlack has ${rules} names`);
  // A name from the list, read from the file the shield searches.
  const names = fs
    .readFileSync(path.join(profile, "shield", "stevenblack.exact"), "latin1")
    .split("\n");
  const listed = names[Math.floor(names.length / 2)];
  assert.deepEqual(await dns.resolve4(listed), ["0.0.0.0"]);
  const real = await dns.resolve4("example.com");
  assert.ok(real.length && !real.includes("0.0.0.0"), "forwarded to Quad9");
  await assert.rejects(dns.resolve4("printer"), /ENOTFOUND/);
  const after = await mainMemory();
  // After the download and parse settle, with the lists in memory.
  await new Promise((r) => setTimeout(r, 20_000));
  const settled = await mainMemory();
  // The page shows the counts and the latest lookups.
  await main.getByText("Most blocked").waitFor({ timeout: 10000 });
  await main.getByText(listed).first().waitFor();
  status = await call("tune.shield");
  assert.equal(status.stats.blocked, 1);
  assert.ok(status.stats.queries >= 2);
  // Off closes the port.
  await main.getByRole("switch", { name: "Network shield" }).click();
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await call("tune.shield")).running, false);
  await assert.rejects(dns.resolve4("example.com"));
  assert.ok(
    !fs.existsSync(path.join(profile, "shield", "stevenblack.txt")),
    "download removed after parsing",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      port,
      rules,
      listed,
      mainPrivateMb: { before, after, settled },
    }),
  );
} finally {
  await app.close();
}
