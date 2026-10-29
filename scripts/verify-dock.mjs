// Desktop check for Yami's dock. Isolated profile. Your windows are only
// listed: a throwaway PowerShell window is the one that gets pinned and
// brought forward. The taskbar's auto-hide is only read, never changed.
import { _electron } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const out = process.argv[2];
const profile = path.resolve(".artifacts/dock-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
let form;
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
  form = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object Windows.Forms.Form; $f.Text = 'Yami dock test'; [void]$f.ShowDialog()",
    ],
    { stdio: "ignore" },
  );
  await wait(2500);
  await call("settings", { dockEnabled: true });
  let dock;
  for (let i = 0; i < 50 && !dock; i++) {
    dock = app.windows().find((p) => p.url().includes("window=dock"));
    if (!dock) await wait(100);
  }
  assert.ok(dock, "the dock window opened");
  let items = await call("dock.items");
  const test = items.find((i) => /powershell/i.test(i.name));
  assert.ok(
    test,
    "the test window's app is in the dock: " + items.map((i) => i.name).join(),
  );
  assert.ok(test.handles.length >= 1, "it has a running dot");
  await call("dock.pin", { path: test.path, name: "PowerShell test" });
  items = await call("dock.items");
  const pinned = items.find((i) => i.pinned && i.name === "PowerShell test");
  assert.ok(pinned && pinned.handles.length, "pinned and still shown as open");
  await call("dock.activate", { key: pinned.key });
  await dock.locator(".dock-item").first().waitFor();
  if (out) await dock.screenshot({ path: path.join(out, "dock.png") });
  assert.equal(
    typeof (await main.evaluate(() => window.yami.invoke("dock.items"))).length,
    "number",
  );
  await call("settings", { dockEnabled: false });
  await wait(600);
  assert.ok(
    !app.windows().some((p) => p.url().includes("window=dock")),
    "the dock closed",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, items: items.length }));
} finally {
  form?.kill();
  await app.close();
}
