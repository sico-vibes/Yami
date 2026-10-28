import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { skipSetup } from "./test-profile.mjs";
const env = {
  ...process.env,
  YAMI_DATA_DIR: path.resolve(".artifacts/e2e-" + Date.now()),
};
delete env.ELECTRON_RUN_AS_NODE;
skipSetup(env.YAMI_DATA_DIR);
let app;
let checks = 0;
const errors = [];
async function launch() {
  app = await electron.launch({ args: [path.resolve(".")], env });
  await app.firstWindow();
  let page;
  for (let i = 0; i < 100; i++) {
    page = app.windows().find((p) => p.url().includes("window=main"));
    if (page) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.waitForSelector(".bottom-dock");
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}
let page = await launch();
const call = (m, a) =>
  page.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
try {
  await call("settings", {
    clipboardEnabled: false,
    reducedMotion: true,
    name: "Verification",
  });
  assert.equal((await call("diagnostics")).native.ok, true);
  checks++;
  await assert.rejects(
    call("apps.launch", { path: "   " }),
    /Choose an application/,
  );
  checks++;
  const nativeControls = await call("controls");
  if (nativeControls.brightness < 0) {
    await assert.rejects(
      call("control", { method: "brightness", args: { value: 50 } }),
      /not available on this monitor/,
    );
    checks++;
  }
  assert.ok((await call("apps")).length > 0);
  assert.ok((await call("metrics")).memory.total > 0);
  checks++;
  for (const name of ["Home", "Bond", "Soul", "Desk", "Settings"]) {
    await page.getByRole("button", { name, exact: true }).click();
    assert.ok(await page.locator(".main-content").isVisible());
    checks++;
  }
  await page
    .locator(".settings-sidebar")
    .getByRole("button", { name: "Shortcuts", exact: true })
    .click();
  const binding = page.getByRole("button", { name: "Change voiceShortcut" });
  await binding.focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await binding.evaluate((e) => document.activeElement === e),
    false,
  );
  checks++;
  await binding.click();
  await page.keyboard.press("Escape");
  assert.equal((await call("state")).settings.voiceShortcut, "Win+Alt");
  await binding.click();
  await page.keyboard.press("Control+Alt+y");
  assert.equal((await call("state")).settings.voiceShortcut, "Ctrl+Alt+Y");
  checks++;
  await page.getByRole("button", { name: "Soul", exact: true }).click();
  const box = await page.locator(".loadout-node").nth(3).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("button", { name: "Change ability trigger" }).click();
  assert.equal((await call("state")).settings.abilityButton, "M1");
  await page.keyboard.press("Escape");
  assert.equal((await call("state")).settings.abilityButton, "M1");
  await page.getByRole("button", { name: "Change ability trigger" }).click();
  await page.keyboard.press("b");
  assert.equal((await call("state")).settings.abilityButton, "K:66");
  await page.getByRole("button", { name: "Close catalogue" }).click();
  checks++;
  await page.getByRole("button", { name: "Desk", exact: true }).click();
  await page.getByPlaceholder("What needs doing?").fill("Verification todo");
  await page.getByRole("button", { name: "Add to-do", exact: true }).click();
  await page.getByText("Verification todo", { exact: true }).waitFor();
  assert.equal((await call("state")).todos.length, 1);
  checks++;
  await page
    .getByRole("button", { name: "Complete Verification todo", exact: true })
    .click();
  assert.equal((await call("state")).todos[0].done, true);
  checks++;
  await page.getByRole("button", { name: "Bond", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Memory", exact: true })
    .fill("Remembered across restart");
  await page.getByRole("button", { name: "Remember", exact: true }).click();
  await page.getByText("Remembered across restart", { exact: true }).waitFor();
  checks++;
  await call("task.save", {
    title: "Verification reminder",
    tool: "remind",
    args: { text: "Verification reminder" },
    at: new Date(Date.now() + 1500).toISOString(),
    repeat: "none",
  });
  let done = false;
  for (let i = 0; i < 70; i++) {
    const t = (await call("state")).tasks.find(
      (t) => t.title === "Verification reminder",
    );
    if (t?.status === "done") {
      done = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(done, "Scheduled reminder should execute");
  checks++;
  const island = app.windows().find((p) => p.url().includes("window=island"));
  for (const tab of [
    "Controls",
    "Today",
    "Stats",
    "Clipboard",
    "Apps",
    "Wallpaper",
    "Power",
  ]) {
    await call("panel", { open: true, tab });
    await island.locator(".utility-" + tab.toLowerCase()).waitFor();
    checks++;
  }
  await island.getByRole("button", { name: "Apps", exact: true }).click();
  await island.getByRole("textbox", { name: "Search apps" }).fill("Calculator");
  assert.equal(
    await island.getByRole("textbox", { name: "Search apps" }).inputValue(),
    "Calculator",
  );
  checks++;
  await call("panel", { open: false });
  await call("lasso.start");
  let selection;
  for (let i = 0; i < 50; i++) {
    selection = app.windows().find((p) => p.url().includes("window=lasso"));
    if (selection) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await selection.waitForSelector(".lasso-screen>img");
  await selection.mouse.move(100, 100);
  await selection.mouse.down();
  await selection.mouse.move(300, 100, { steps: 6 });
  await selection.mouse.move(300, 250, { steps: 6 });
  await selection.mouse.move(100, 250, { steps: 6 });
  await selection.mouse.move(100, 100, { steps: 6 });
  await selection.mouse.up();
  await page.locator(".selection-preview img").waitFor();
  checks++;
  await page.getByRole("button", { name: "Remove selection" }).click();
  await app.close();
  page = await launch();
  const state = await call("state");
  assert.equal(state.memories[0].text, "Remembered across restart");
  assert.equal(state.todos.length, 1);
  assert.equal(state.tasks[0].enabled, false);
  checks++;
  assert.equal(errors.length, 0, errors.join("\n"));
  fs.writeFileSync(
    ".artifacts/e2e-results.json",
    JSON.stringify(
      {
        checks,
        errors,
        providerCalls: "not run: no user credentials supplied",
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS: ${checks} Electron/native checks; persistence, scheduler, utility tabs and lasso verified.`,
  );
} finally {
  await app.close();
}
