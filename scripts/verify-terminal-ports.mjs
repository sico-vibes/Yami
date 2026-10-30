// Desktop check for the terminal's port finder: a tab starts a tiny Node web
// server on a random port, and Servers this tab started shows it. A server
// this script starts itself (not in the tab) must not be listed. Isolated
// profile; the tab's server ends with the session.
import { _electron } from "playwright";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/ports-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile, YAMI_TERMINAL_SHELL: "" };
delete env.ELECTRON_RUN_AS_NODE;
const port = 41000 + Math.floor(Math.random() * 2000);
const outside = http.createServer((_q, r) => r.end("outside"));
await new Promise((r) => outside.listen(0, "127.0.0.1", r));
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
  await wait(2500);
  const servers = terminal.getByRole("button", {
    name: "Servers this tab started",
  });
  await servers.click();
  await terminal
    .getByText("Nothing in this tab is listening on a port yet.")
    .waitFor();
  // Typing goes to the terminal again, not to the button just pressed.
  await terminal
    .locator(".terminal-view:not([hidden]) .xterm")
    .first()
    .click({ position: { x: 60, y: 40 } });
  // node -e works the same in PowerShell, cmd and Git Bash with these quotes.
  await terminal.keyboard.type(
    `node -e "require('http').createServer((q,r)=>r.end('tab')).listen(${port})"`,
  );
  await terminal.keyboard.press("Enter");
  let shown = false;
  for (let i = 0; i < 40 && !shown; i++) {
    await wait(500);
    await terminal.getByRole("button", { name: "Look again" }).click();
    shown =
      (await terminal
        .getByRole("button", { name: new RegExp(`localhost:${port}`) })
        .count()) > 0;
  }
  if (!shown) {
    const session = await terminal
      .locator("[data-session].selected")
      .getAttribute("data-session");
    console.log(
      "debug",
      session,
      JSON.stringify(
        await terminal.evaluate(
          (s) => window.yami.invoke("terminal.ports", { session: s }),
          session,
        ),
      ),
      await fetch(`http://localhost:${port}/`).then(
        (r) => r.text(),
        (e) => e.message,
      ),
    );
  }
  assert.ok(shown, "the tab's server is listed");
  const listed = await terminal
    .locator(".terminal-ports button.soft-button")
    .allTextContents();
  assert.ok(
    listed.some((t) => t.includes("node")),
    listed.join(),
  );
  assert.ok(
    !listed.some((t) => t.includes(`localhost:${outside.address().port}`)),
    "a server outside the tab is not listed",
  );
  const body = await (await fetch(`http://localhost:${port}/`)).text();
  assert.equal(body, "tab");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, port, listed }));
} finally {
  await app.close();
  outside.close();
}
