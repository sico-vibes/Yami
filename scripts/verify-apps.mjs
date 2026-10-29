// Desktop check for Tune › Installed apps, confined to a throwaway key:
// YAMI_APPS_ROOT points the list at HKCU\Software\YamiAppsVerify-<time>,
// where two fake apps are registered. Their "uninstaller" only writes a
// marker file, so no real app is ever removed. The key is deleted at the end.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const sandbox = "Software\\YamiAppsVerify-" + Date.now();
const profile = path.resolve(".artifacts/apps-verify-" + Date.now());
skipSetup(profile);
const marker = path.join(profile, "uninstalled.txt");
const reg = (...args) =>
  execFileSync("reg.exe", args, { encoding: "utf8", windowsHide: true });
const add = (key, name, value, type = "REG_SZ") =>
  reg(
    "add",
    "HKCU\\" + sandbox + "\\" + key,
    "/v",
    name,
    "/t",
    type,
    "/d",
    value,
    "/f",
  );
add("VerifyNotes", "DisplayName", "Yami Verify Notes");
add("VerifyNotes", "Publisher", "Yami tests");
add("VerifyNotes", "DisplayVersion", "1.2.3");
add("VerifyNotes", "EstimatedSize", "2048", "REG_DWORD");
// Like a real uninstaller: a quoted path to a program in the app's folder.
const uninstaller = path.join(profile, "Verify Notes", "uninstall.cmd");
fs.mkdirSync(path.dirname(uninstaller), { recursive: true });
fs.writeFileSync(uninstaller, `@echo removed>"${marker}"\r\n`);
add("VerifyNotes", "UninstallString", `"${uninstaller}"`);
// The same app registered twice is shown once.
add("VerifyNotesCopy", "DisplayName", "Yami Verify Notes");
add("VerifyNotesCopy", "DisplayVersion", "1.2.3");
add("VerifyNotesCopy", "UninstallString", "cmd.exe /c exit");
// Hidden from the list: a system component, an update, no uninstaller.
add("VerifyHidden", "DisplayName", "Yami Verify Component");
add("VerifyHidden", "UninstallString", "cmd.exe /c exit");
add("VerifyHidden", "SystemComponent", "1", "REG_DWORD");
add("VerifyUpdate", "DisplayName", "Yami Verify Update");
add("VerifyUpdate", "UninstallString", "cmd.exe /c exit");
add("VerifyUpdate", "ParentKeyName", "VerifyNotes");
add("VerifyBare", "DisplayName", "Yami Verify Bare");
add("VerifyPaint", "DisplayName", "Yami Verify Paint");
add("VerifyPaint", "UninstallString", "cmd.exe /c exit");

const env = {
  ...process.env,
  YAMI_DATA_DIR: profile,
  YAMI_APPS_ROOT: "HKCU:\\" + sandbox,
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await new Promise((r) => setTimeout(r, 100));
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  await call("modules.set", { id: "tune", enabled: true });
  const list = await call("tune.apps");
  assert.deepEqual(
    list.map((a) => [a.name, a.publisher, a.version, a.sizeKb, a.user]),
    [
      ["Yami Verify Notes", "Yami tests", "1.2.3", 2048, true],
      ["Yami Verify Paint", "", "", 0, true],
    ],
  );
  // Only an id from the last list is accepted; never a command.
  await assert.rejects(
    call("tune.apps.uninstall", { id: "cmd.exe /c calc" }),
    /not in it/,
  );
  // Through the page: search, Uninstall, confirm.
  await main.getByRole("button", { name: "Tune", exact: true }).click();
  await main.getByRole("button", { name: "Show apps" }).click();
  await main.getByPlaceholder("Search 2 apps").fill("notes");
  assert.equal(await main.getByText("Yami Verify Paint").count(), 0);
  await main
    .getByRole("button", { name: "Uninstall Yami Verify Notes" })
    .click();
  await main.getByText("Uninstall Yami Verify Notes?").waitFor();
  await main
    .locator(".dialog-actions")
    .getByRole("button", { name: "Uninstall" })
    .click();
  for (
    let i = 0;
    i < 100 && !(fs.existsSync(marker) && fs.statSync(marker).size);
    i++
  )
    await new Promise((r) => setTimeout(r, 100));
  assert.match(fs.readFileSync(marker, "utf8"), /removed/, "uninstaller ran");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, listed: list.length, sandbox }));
} finally {
  await app.close();
  try {
    reg("delete", "HKCU\\" + sandbox, "/f");
  } catch {}
}
