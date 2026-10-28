// Desktop check for terminal shells and scrollback search: opens a Git Bash
// tab (when Git for Windows is installed), runs a harmless echo, then finds
// the output with Ctrl+Shift+F. Uses an isolated profile.
import { _electron } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/shells-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
let marks = {};
// The shells sit in this folder, so it is removed after they end.
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "yami-marks-"));
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
  // Shell integration: each shell reports its folder; PowerShell and Git
  // Bash also report how the last command exited.
  const saved = await app.evaluate(({ clipboard }) => clipboard.readText());
  marks = {};
  const labels = {
    powershell: "Windows PowerShell",
    pwsh: "PowerShell 7",
    cmd: "Command Prompt",
    bash: "Git Bash",
  };
  try {
    for (const name of ["powershell", "pwsh", "cmd", "bash"]) {
      if (!shells.includes(name)) continue;
      const tabs = await terminal.locator("[data-session]").count();
      await terminal
        .getByRole("combobox", { name: "Shell for new tabs" })
        .click();
      await terminal.getByRole("option", { name: labels[name] }).click();
      await terminal
        .getByRole("button", { name: "New terminal session" })
        .click();
      await terminal
        .locator("[data-session]")
        .nth(tabs)
        .waitFor({ timeout: 20000 });
      await wait(name === "pwsh" ? 4000 : 2500);
      const where = name === "bash" ? folder.replace(/\\/g, "/") : folder;
      await terminal.keyboard.type(`cd "${where}"`);
      await terminal.keyboard.press("Enter");
      await wait(1200);
      await terminal.keyboard.type(
        name === "bash"
          ? "(exit 4)"
          : name === "cmd"
            ? "echo marks"
            : "cmd /c exit 4",
      );
      await terminal.keyboard.press("Enter");
      await wait(1500);
      const footer = await terminal.locator(".terminal-footer").innerText();
      const exit = await terminal
        .locator(".terminal-exit")
        .innerText()
        .catch(() => "");
      marks[name] = {
        cwd: footer.toLowerCase().includes(folder.toLowerCase()),
        exit,
      };
      assert.ok(marks[name].cwd, `${name} reported its folder: ${footer}`);
      if (name !== "cmd") {
        assert.match(exit, /Exit 4/, `${name} reported the exit code`);
        await terminal
          .getByRole("button", { name: "Copy the last command and its output" })
          .click();
        await wait(300);
        const copied = await app.evaluate(({ clipboard }) =>
          clipboard.readText(),
        );
        const problem = await terminal
          .locator(".terminal-error")
          .innerText()
          .catch(() => "");
        assert.match(
          copied,
          /exit 4/,
          `${name} copied the last block: ${problem}`,
        );
      }
    }
  } finally {
    await app.evaluate(
      ({ clipboard }, text) => clipboard.writeText(text),
      saved,
    );
  }
  // A long command that ends while the window is hidden gets a notice.
  const notices = [];
  await main.exposeFunction("__notice", (m) => notices.push(m));
  await main.evaluate(() =>
    window.yami.on(
      (e) => e.type === "caption-notice" && window.__notice(e.message),
    ),
  );
  const session = await terminal
    .locator("[data-session]")
    .first()
    .getAttribute("data-session");
  await terminal.evaluate(() => window.yami.invoke("terminal.hide"));
  await wait(300);
  assert.equal(
    await terminal.evaluate(
      (id) =>
        window.yami.invoke("terminal.finished", {
          session: id,
          title: "Build",
          exit: 2,
          ms: 42000,
        }),
      session,
    ),
    true,
  );
  for (let i = 0; i < 20 && !notices.length; i++) await wait(100);
  assert.deepEqual(notices, ["Build: the command failed (exit 2) after 42 s."]);
  await main.evaluate(() => window.yami.invoke("terminal.open"));
  for (const tab of await terminal.locator("[data-session]").all())
    await terminal.evaluate(
      (id) => window.yami.invoke("terminal.end", { session: id }),
      await tab.getAttribute("data-session"),
    );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, shells, checked, marks }));
} finally {
  await app.close();
  fs.rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
}
