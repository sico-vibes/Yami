// Desktop check for Tune › Mouse pointer, confined to a throwaway key:
// YAMI_TUNE_ROOT moves the pointer values under HKCU\Software\YamiCursorVerify-<time>,
// seeded with a copy of your current ones. The page picks Windows Black and
// size 3, then Put back. Your real pointer values are compared before and
// after, and Windows is never asked to reload pointers in the sandbox.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const sandbox = "Software\\YamiCursorVerify-" + Date.now();
const profile = path.resolve(".artifacts/cursor-verify-" + Date.now());
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
const real = "HKCU\\Control Panel\\Cursors";
const realBefore = reg("query", real);
const box = "HKCU\\" + sandbox + "\\Control Panel\\Cursors";
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
  // Wait for Tune's sections to load, so the page stops moving under the menu.
  await main
    .getByText("Reading network adapters…")
    .waitFor({ state: "detached" });
  const pick = async (label, option) => {
    const box = main.getByRole("combobox", { name: label });
    await box.scrollIntoViewIfNeeded();
    await new Promise((r) => setTimeout(r, 400));
    await box.click();
    await main.getByRole("option", { name: option, exact: true }).click();
  };
  await pick("Pointer scheme", "Windows Black");
  await main.getByRole("button", { name: "Put back" }).waitFor();
  await pick("Pointer size", "3");
  await new Promise((r) => setTimeout(r, 800));
  const during = reg("query", box);
  assert.match(
    during,
    /Arrow\s+REG_EXPAND_SZ\s+%SystemRoot%\\cursors\\arrow_r\.cur/i,
  );
  assert.match(during, /\(Default\)\s+REG_SZ\s+Windows Black/);
  assert.match(during, /CursorBaseSize\s+REG_DWORD\s+0x40/);
  assert.match(
    reg(
      "query",
      "HKCU\\" + sandbox + "\\Software\\Microsoft\\Accessibility",
      "/v",
      "CursorSize",
    ) || "",
    /0x3/,
  );
  await main.getByRole("button", { name: "Put back" }).click();
  await main
    .getByRole("button", { name: "Put back" })
    .waitFor({ state: "detached" });
  assert.equal(
    reg("query", box),
    boxBefore,
    "sandbox values exactly as before",
  );
  assert.equal(reg("query", real), realBefore, "your real pointer untouched");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, sandbox }));
} finally {
  await app.close();
  reg("delete", "HKCU\\" + sandbox, "/f");
}
