// LIVE check, run only with the owner's approval: makes a restore point,
// stops the DiagTrack service through Tune, then puts it back exactly as it
// was. Three Windows UAC prompts appear, one per step. Isolated profile.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/admin-live-" + Date.now());
skipSetup(profile);
const service = () =>
  JSON.parse(
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-Service DiagTrack | Select-Object @{n='start';e={[string]$_.StartType}},@{n='status';e={[string]$_.Status}} | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8" },
    ),
  );
const before = service();
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const steps = { before };
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
  console.log("1/3 Accept the prompt to make a restore point…");
  steps.restorePoint = await call("tune.admin.restorePoint").catch((e) => ({
    error: e.message,
  }));
  console.log("2/3 Accept the prompt to stop DiagTrack…");
  await call("tune.admin.service", { name: "DiagTrack", off: true });
  steps.stopped = service();
  console.log("3/3 Accept the prompt to put DiagTrack back…");
  await call("tune.admin.service", { name: "DiagTrack", off: false });
  await wait(1500);
  steps.after = service();
  assert.equal(steps.stopped.start, "Disabled");
  assert.notEqual(steps.stopped.status, "Running");
  assert.equal(steps.after.start, before.start, "start type restored");
  assert.equal(steps.after.status, before.status, "running state restored");
  console.log(JSON.stringify({ passed: true, steps }));
} catch (error) {
  console.log(JSON.stringify({ passed: false, steps, error: error.message }));
  process.exitCode = 1;
} finally {
  await app.close();
}
