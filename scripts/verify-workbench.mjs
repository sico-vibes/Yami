import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const profile = path.resolve(".artifacts/workbench-verify-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(
  path.join(profile, "data.json"),
  JSON.stringify({
    settings: {
      hotkeys: false,
      roam: false,
      clipboardEnabled: false,
      contextEnabled: false,
      weatherEnabled: false,
    },
    messages: [
      {
        id: "preserve",
        role: "user",
        text: "Preserved fixture conversation",
        at: new Date().toISOString(),
      },
    ],
  }),
);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const packaged = process.argv.includes("--packaged");
const app = await _electron.launch(
  packaged
    ? {
        executablePath: path.resolve(
          process.env.YAMI_PACKAGE_DIR || "release",
          "win-unpacked/Yami.exe",
        ),
        args: [],
        env,
      }
    : { args: [path.resolve(".")], env },
);
const errors = [],
  helpers = new Set();
app.on("window", (page) => page.on("pageerror", (e) => errors.push(e.message)));
async function windowFor(mode) {
  for (let i = 0; i < 100; i++) {
    const p = app.windows().find((p) => p.url().includes("window=" + mode));
    if (p) return p;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Missing window: " + mode);
}
try {
  await app.firstWindow();
  const main = await windowFor("main");
  await main.locator(".bottom-dock").waitFor();
  await main.getByRole("button", { name: "AI", exact: true }).click();
  await main.getByRole("heading", { name: "Agent sessions" }).waitFor();
  const state = await main.evaluate(() => window.yami.invoke("state"));
  assert.ok(
    state.messages.some((m) => m.text === "Preserved fixture conversation"),
  );
  await main.evaluate(() =>
    window.yami.invoke("workbench.settings", { monitor: true }),
  );
  const hook = packaged
    ? path.resolve(
        process.env.YAMI_PACKAGE_DIR || "release",
        "win-unpacked/resources/native/Yami.Hook.exe",
      )
    : path.resolve("native/bin/Yami.Hook.exe");
  const relay = path.join(profile, "agent-relay.json");
  async function permission(decision) {
    const child = execFile(hook, ["claude", "PermissionRequest", relay], {
      windowsHide: true,
      timeout: 15000,
    });
    const result = new Promise((resolve, reject) => {
      let output = "";
      child.stdout.on("data", (d) => (output += d));
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve(JSON.parse(output))
          : reject(new Error("Relay exit " + code)),
      );
    });
    child.stdin.end(
      JSON.stringify({
        session_id: "fixture-" + decision,
        cwd: profile,
        tool_name: "Bash",
        tool_input: { command: "echo fixture" },
      }),
    );
    // The visible approval card ACKs the exact pending request before replying.
    const button = main.getByRole("button", {
      name: decision === "allow" ? "Allow once" : "Deny",
      exact: true,
    });
    await button.waitFor({ timeout: 5000 });
    await button.click();
    assert.equal((await result).hookSpecificOutput.decision.behavior, decision);
  }
  await permission("allow");
  await permission("deny");
  await main.evaluate(() =>
    window.yami.invoke("workbench.settings", { monitor: false }),
  );
  await main
    .getByRole("button", { name: "Open terminal", exact: true })
    .click();
  const terminal = await windowFor("terminal");
  await terminal.locator("[data-session]").first().waitFor();
  const id = await terminal
    .locator("[data-session]")
    .first()
    .getAttribute("data-session");
  await terminal.evaluate(() => {
    window.testOutput = "";
    const decoder = new TextDecoder();
    window.yami.on((e) => {
      if (e.type === "terminal-output" && e.kind === "data")
        window.testOutput += decoder.decode(
          Uint8Array.from(atob(e.data), (c) => c.charCodeAt(0)),
          { stream: true },
        );
    });
  });
  const write = (text) =>
    terminal.evaluate(
      ({ id, text }) =>
        window.yami.invoke("terminal.write", { session: id, text }),
      { id, text },
    );
  await terminal.evaluate(
    (id) =>
      window.yami.invoke("terminal.resize", {
        session: id,
        cols: 110,
        rows: 30,
      }),
    id,
  );
  await write(
    "$yamiFixture = 'PERSIST'; Write-Output ('YAMI_' + $yamiFixture)\r",
  );
  await terminal.waitForFunction(() =>
    window.testOutput.includes("YAMI_PERSIST"),
  );
  await write("Write-Output ('YAMI_' + $yamiFixture + '_AGAIN')\r");
  await terminal.waitForFunction(() =>
    window.testOutput.includes("YAMI_PERSIST_AGAIN"),
  );
  await write("Start-Sleep -Seconds 60\r");
  await new Promise((r) => setTimeout(r, 600));
  await write("\x03");
  await new Promise((r) => setTimeout(r, 700));
  await write("Write-Output ('YAMI_' + 'INTERRUPTED')\r");
  try {
    await terminal.waitForFunction(
      () => window.testOutput.includes("YAMI_INTERRUPTED"),
      {},
      { timeout: 8000 },
    );
  } catch (error) {
    console.log(await terminal.evaluate(() => window.testOutput));
    throw error;
  }
  await write(
    "$p = Start-Process -FilePath $env:ComSpec -ArgumentList '/c ping -n 120 127.0.0.1 >nul' -WindowStyle Hidden -PassThru; Write-Output ('YAMI_CHILD_' + $p.Id + '_END')\r",
  );
  await terminal.waitForFunction(() =>
    /YAMI_CHILD_\d+_END/.test(window.testOutput),
  );
  const childPid = Number(
    (await terminal.evaluate(() => window.testOutput)).match(
      /YAMI_CHILD_(\d+)_END/,
    )[1],
  );
  helpers.add(childPid);
  await write(
    "1..4096 | ForEach-Object { Write-Output ('bounded-output-' * 18) }; Write-Output ('YAMI_' + 'BURST_DONE'); Write-Output ('YAMI_UNICODE_' + [char]0x03bb)\r",
  );
  await terminal.waitForFunction(
    () =>
      window.testOutput.includes("YAMI_BURST_DONE") &&
      window.testOutput.includes("YAMI_UNICODE_λ"),
    {},
    { timeout: 20000 },
  );
  await terminal.screenshot({ path: path.join(profile, "terminal.png") });
  await main.screenshot({ path: path.join(profile, "workspace.png") });
  await terminal.evaluate(
    (id) => window.yami.invoke("terminal.end", { session: id }),
    id,
  );
  await new Promise((r) => setTimeout(r, 500));
  await assert.rejects(
    exec("tasklist.exe", ["/FI", `PID eq ${childPid}`, "/FO", "CSV", "/NH"], {
      windowsHide: true,
    }).then(({ stdout }) => {
      if (stdout.includes(`"${childPid}"`))
        throw new Error("Owned child still running");
      return Promise.reject(new Error("reaped"));
    }),
    /reaped/,
  );
  helpers.delete(childPid);
  const wb = await main.evaluate(() => window.yami.invoke("workbench.state"));
  assert.equal(wb.settings.usageBackground, false);
  assert.equal(wb.connections.length, 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      packaged,
      profile,
      checks: [
        "preserved conversation",
        "native relay Allow/Deny",
        "visible approval ACK",
        "persistent PTY",
        "resize",
        "Ctrl+C",
        "Unicode and 1 MB output burst",
        "descendant cleanup",
        "optional background work off",
        "no renderer errors",
      ],
    }),
  );
} finally {
  await app.close();
  for (const pid of helpers) {
    try {
      await exec("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
        windowsHide: true,
      });
    } catch {}
  }
}
