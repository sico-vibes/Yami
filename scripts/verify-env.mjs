// Desktop check for Tune › Environment variables, confined to a throwaway
// key: YAMI_TUNE_ROOT moves HKCU\Environment under
// HKCU\Software\YamiEnvVerify-<time>, seeded with a copy of yours. The page
// adds a folder to Path, then Put back. Your real variables are compared
// before and after; Windows is not told about the sandbox.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const sandbox = "Software\\YamiEnvVerify-" + Date.now();
const profile = path.resolve(".artifacts/env-verify-" + Date.now());
skipSetup(profile);
const reg = (...args) => {
  try {
    return execFileSync("reg.exe", args, {
      encoding: "utf8",
      windowsHide: true,
    });
  } catch {
    return null;
  }
};
const real = "HKCU\\Environment";
const realBefore = reg("query", real);
const box = "HKCU\\" + sandbox + "\\Environment";
reg("copy", real, box, "/s", "/f");
const boxBefore = reg("query", box);
const env = { ...process.env, YAMI_DATA_DIR: profile, YAMI_TUNE_ROOT: sandbox };
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
  await main.evaluate(() =>
    window.yami.invoke("modules.set", { id: "tune", enabled: true }),
  );
  await main.getByRole("button", { name: "Tune", exact: true }).click();
  await main.getByRole("button", { name: "Show variables" }).click();
  const folder = "D:\\YamiEnvVerify\\bin";
  await main.getByLabel("Folder to add to Path").fill(folder);
  await main.getByRole("button", { name: "Add folder" }).click();
  await main.getByText(folder, { exact: true }).waitFor();
  const after = reg("query", box) || "(no key)";
  assert.ok(after.includes(folder), "Path changed in the sandbox: " + after.slice(0, 600));
  await main.getByRole("button", { name: "Put back" }).click();
  await main
    .getByRole("button", { name: "Put back" })
    .waitFor({ state: "detached" });
  assert.equal(reg("query", box), boxBefore, "sandbox exactly as before");
  assert.equal(reg("query", real), realBefore, "your real variables untouched");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, sandbox }));
} finally {
  await app.close();
  reg("delete", "HKCU\\" + sandbox, "/f");
}
