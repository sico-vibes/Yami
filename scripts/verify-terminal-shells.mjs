// Desktop check for terminal shells and scrollback search: opens a Git Bash
// tab (when Git for Windows is installed), runs a harmless echo, then finds
// the output with Ctrl+Shift+F. Uses an isolated profile.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/shells-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const windowFor = async (mode) => {
  for (let i = 0; i < 150; i++) {
    const p = app.windows().find((p) => p.url().includes("window=" + mode));
    if (p) return p;
    await wait(100);
  }
  throw new Error("Missing window: " + mode);
};
try {
  await app.firstWindow();
  const main = await windowFor("main");
  await main.locator(".bottom-dock").waitFor();
  await main.evaluate(() => window.yami.invoke("terminal.open"));
  const terminal = await windowFor("terminal");
  await terminal.locator("[data-session]").first().waitFor({ timeout: 20000 });
  const shells = await terminal.evaluate(() =>
    window.yami.invoke("terminal.shells"),
  );
  assert.ok(
    shells.includes("cmd") || shells.includes("powershell"),
    shells.join(),
  );
  await assert.rejects(
    terminal.evaluate(() =>
      window.yami.invoke("terminal.create", { shell: "evil" }),
    ),
    /Unsupported shell/,
  );
  let checked = "default shell";
  if (shells.includes("bash")) {
    await terminal
      .getByRole("combobox", { name: "Shell for new tabs" })
      .click();
    await terminal.getByRole("option", { name: "Git Bash" }).click();
    await terminal
      .getByRole("button", { name: "New terminal session" })
      .click();
    await terminal.locator("[data-session]").nth(1).waitFor({ timeout: 20000 });
    checked = "Git Bash";
  }
  // Type a harmless command into the selected tab and find its output.
  await wait(2500);
  await terminal.keyboard.type("echo yami-$((20+22))");
  await terminal.keyboard.press("Enter");
  await wait(1500);
  await terminal.keyboard.press("Control+Shift+F");
  const box = terminal.getByLabel("Find in this tab");
  await box.waitFor();
  await box.fill(checked === "Git Bash" ? "yami-42" : "yami-");
  await box.press("Enter");
  await wait(300);
  assert.equal(
    await terminal.locator(".terminal-error").count(),
    0,
    "found in the scrollback",
  );
  await box.fill("text-that-is-not-there");
  await box.press("Enter");
  await terminal.locator(".terminal-error").waitFor();
  // Split view: two panes side by side; pressing the right one swaps them.
  await box.press("Escape");
  await terminal.getByRole("button", { name: /^Split/ }).click();
  const shown = () => terminal.locator(".terminal-view:not([hidden])");
  await wait(400);
  assert.equal(await shown().count(), 2, "two panes");
  assert.equal(await terminal.locator(".terminal-view.pane-a").count(), 1);
  const before = await terminal
    .locator("[data-session].selected")
    .getAttribute("data-session");
  await terminal
    .locator(".terminal-view.pane-b")
    .click({ position: { x: 40, y: 40 } });
  await wait(300);
  const after = await terminal
    .locator("[data-session].selected")
    .getAttribute("data-session");
  assert.notEqual(after, before, "the right pane took input");
  await terminal.getByRole("button", { name: "Show one tab" }).click();
  await wait(300);
  assert.equal(await shown().count(), 1, "back to one");
  for (const tab of await terminal.locator("[data-session]").all())
    await terminal.evaluate(
      (id) => window.yami.invoke("terminal.end", { session: id }),
      await tab.getAttribute("data-session"),
    );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, shells, checked }));
} finally {
  await app.close();
}
