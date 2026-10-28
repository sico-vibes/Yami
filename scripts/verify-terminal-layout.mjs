// Desktop check for terminal layout restore across a real restart: two
// tabs, one moved into a temporary folder, are reopened with that folder
// the next time Yami starts. Isolated profile.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/terminal-layout-" + Date.now());
skipSetup(profile);
const folder = path.join(profile, "work here");
fs.mkdirSync(folder, { recursive: true });
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function withTerminal(fn) {
  const app = await _electron.launch({ args: [path.resolve(".")], env });
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
    await wait(2500);
    return await fn(t);
  } finally {
    await app.close();
  }
}

await withTerminal(async (t) => {
  await t.getByRole("button", { name: "New terminal session" }).click();
  await t.locator("[data-session]").nth(1).waitFor({ timeout: 20000 });
  await wait(2500);
  await t.keyboard.type(`cd "${folder}"`);
  await t.keyboard.press("Enter");
  for (let i = 0; i < 40; i++) {
    if ((await t.locator(".terminal-footer").innerText()).includes(folder))
      break;
    await wait(150);
  }
  await wait(1500);
  const saved = JSON.parse(
    fs.readFileSync(path.join(profile, "terminal-layout.json"), "utf8"),
  );
  assert.equal(saved.length, 2);
  assert.equal(saved[1].cwd, folder);
});
const reopened = await withTerminal(async (t) => {
  const tabs = await t.locator("[data-session]").count();
  await t.locator("[data-session]").nth(1).click();
  await wait(500);
  const footer = await t.locator(".terminal-footer").innerText();
  for (const tab of await t.locator("[data-session]").all())
    await t.evaluate(
      (id) => window.yami.invoke("terminal.end", { session: id }),
      await tab.getAttribute("data-session"),
    );
  return { tabs, footer };
});
assert.equal(reopened.tabs, 2, "both tabs came back");
assert.ok(reopened.footer.includes(folder), reopened.footer);
console.log(JSON.stringify({ passed: true, tabs: reopened.tabs }));
