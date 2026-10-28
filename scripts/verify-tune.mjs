// Desktop check for Tune with real reg.exe, confined to a throwaway key:
// YAMI_TUNE_ROOT moves every tweak under HKCU\Software\YamiTuneVerify-<time>.
// Your real settings are read before and after to prove they did not change.
// The sandbox key is deleted at the end. Explorer is never restarted.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const sandbox = "Software\\YamiTuneVerify-" + Date.now();
const profile = path.resolve(".artifacts/tune-verify-" + Date.now());
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
const realKey =
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced";
const realBefore = reg("query", realKey);
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
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  await assert.rejects(call("tune.list"), /turned off/);
  await call("modules.set", { id: "tune", enabled: true });
  await main.getByRole("button", { name: "Tune", exact: true }).waitFor();
  const ids = (await call("tune.list")).map((s) => s.id);
  let list = await call("tune.apply", { ids });
  assert.ok(
    list.every((s) => s.applied && s.undoable),
    "all applied",
  );
  const full = (key) => "HKCU\\" + sandbox + "\\" + key;
  assert.match(
    reg(
      "query",
      full("Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"),
      "/v",
      "HideFileExt",
    ) || "",
    /HideFileExt\s+REG_DWORD\s+0x0/,
  );
  assert.match(
    reg(
      "query",
      full("Control Panel\\Accessibility\\StickyKeys"),
      "/v",
      "Flags",
    ) || "",
    /Flags\s+REG_SZ\s+506/,
  );
  const owned = full(
    "Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}",
  );
  assert.notEqual(reg("query", owned), null, "classic menu key written");
  list = await call("tune.undo", { ids });
  assert.ok(
    list.every((s) => !s.applied && !s.undoable),
    "all undone",
  );
  assert.equal(reg("query", owned), null, "the key Yami created is gone");
  assert.equal(
    reg(
      "query",
      full("Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced"),
      "/v",
      "HideFileExt",
    ),
    null,
    "a value that was not set is removed again",
  );
  // The page renders the rows from the live states.
  await main.getByRole("button", { name: "Tune", exact: true }).click();
  await main.getByText("Classic right-click menu").waitFor();
  assert.equal(reg("query", realKey), realBefore, "real settings untouched");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, tweaks: ids.length, sandbox }));
} finally {
  await app.close();
  reg("delete", "HKCU\\" + sandbox, "/f");
}
