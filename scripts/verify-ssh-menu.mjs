// Desktop check for SSH hosts in Yami Terminal's shell menu. USERPROFILE
// points at a fixture whose ~/.ssh/config has one host aimed at a closed
// local port, so choosing it starts ssh without reaching any real server.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/ssh-menu-" + Date.now());
skipSetup(profile);
const home = path.join(profile, "home");
fs.mkdirSync(path.join(home, ".ssh"), { recursive: true });
fs.writeFileSync(
  path.join(home, ".ssh", "config"),
  "Host *\r\n  ConnectTimeout 2\r\nHost yami-demo-box\r\n  HostName 127.0.0.1\r\n  Port 9\r\n",
);
const env = { ...process.env, YAMI_DATA_DIR: profile, USERPROFILE: home };
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
  await main.evaluate(() => window.yami.invoke("terminal.open"));
  let t;
  for (let i = 0; i < 100 && !t; i++) {
    t = app.windows().find((p) => p.url().includes("window=terminal"));
    if (!t) await wait(100);
  }
  await t.locator("[data-session]").first().waitFor({ timeout: 20000 });
  assert.deepEqual(await t.evaluate(() => window.yami.invoke("terminal.ssh")), [
    "yami-demo-box",
  ]);
  await t.getByRole("combobox", { name: "Shell for new tabs" }).click();
  await t.getByRole("option", { name: "SSH: yami-demo-box" }).click();
  await t.getByRole("button", { name: "New terminal session" }).click();
  await t
    .getByRole("button", { name: "yami-demo-box" })
    .waitFor({ timeout: 20000 });
  // ssh ends at the closed port, or, since ssh.exe finds its config through
  // Windows' real profile folder, fails to resolve the fixture name.
  let screen = "";
  for (
    let i = 0;
    i < 60 && !/refused|timed out|Connection|resolve hostname/i.test(screen);
    i++
  ) {
    await wait(250);
    screen =
      (await t
        .locator(".terminal-view:not([hidden]) .xterm-rows")
        .textContent()) || "";
  }
  assert.match(screen, /ssh yami-demo-box/);
  assert.match(screen, /refused|timed out|Connection|resolve hostname/i, screen.slice(-300));
  for (const tab of await t.locator("[data-session]").all())
    await t.evaluate(
      (id) => window.yami.invoke("terminal.end", { session: id }),
      await tab.getAttribute("data-session"),
    );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true }));
} finally {
  await app.close();
}
