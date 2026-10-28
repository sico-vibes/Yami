// Desktop check for the mail catcher pack: downloads Mailpit through Yami's
// pinned downloader (about 11 MB from GitHub), checks it is reported as
// installed and that Dev › Projects offers Start. It does not start Mailpit;
// running the downloaded program is left to a person. Isolated profile.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/mailcatcher-" + Date.now());
skipSetup(profile);
// Isolated profiles keep their downloads under <profile>/engines.
const env = { ...process.env, YAMI_DATA_DIR: profile };
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
  assert.equal((await call("mailcatcher.status")).installed, false);
  await assert.rejects(call("mailcatcher.start"), /Download the Mailpit pack/);
  await call("modules.set", { id: "workbench", enabled: true });
  await call("packs.install", { id: "mailpit" });
  let pack;
  for (let i = 0; i < 240; i++) {
    const list = await call("modules.list");
    pack = list
      .find((m) => m.id === "workbench")
      .packs.find((p) => p.id === "mailpit");
    if (pack.state === "installed" || pack.state === "failed") break;
    await wait(500);
  }
  assert.equal(pack.state, "installed", pack.error);
  assert.equal((await call("mailcatcher.status")).installed, true);
  const exe = fs
    .readdirSync(path.join(profile, "engines"), { recursive: true })
    .find((f) => String(f).toLowerCase().endsWith("mailpit.exe"));
  assert.ok(exe, "mailpit.exe unpacked under the engines folder");
  await call("show", { tab: "ai" });
  await main.getByRole("button", { name: "Projects" }).first().click();
  await main.getByText("Mail catcher").waitFor();
  await main.getByRole("button", { name: "Start" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, version: pack.version, exe }));
} finally {
  await app.close();
}
