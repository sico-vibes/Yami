// Desktop check for Tune › Cleanup. Cleaning runs only in a throwaway folder
// (YAMI_CLEANUP_ROOT), through the page. A second launch measures this PC's
// real folders and removes nothing.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const stamp = Date.now();
const root = path.resolve(".artifacts/cleanup-sandbox-" + stamp);
const old = new Date(stamp - 3 * 24 * 60 * 60_000);
const put = (rel, bytes, at) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(bytes));
  if (at) fs.utimesSync(file, at, at);
};
put("Temp/old.log", 4096, old);
put("Temp/today.log", 100);
put("LocalAppData/D3DSCache/x/cache.bin", 8192);
put("RecycleBin/$Rdeleted.txt", 64);

async function launch(extra) {
  const profile = path.resolve(
    `.artifacts/cleanup-verify-${stamp}-${extra ? "box" : "real"}`,
  );
  skipSetup(profile);
  const env = { ...process.env, YAMI_DATA_DIR: profile, ...extra };
  delete env.ELECTRON_RUN_AS_NODE;
  if (!extra) delete env.YAMI_CLEANUP_ROOT;
  const app = await _electron.launch({ args: [path.resolve(".")], env });
  const errors = [];
  app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
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
  return { app, main, call, errors };
}

let report;
{
  const { app, main, errors } = await launch({ YAMI_CLEANUP_ROOT: root });
  try {
    await main.getByRole("button", { name: "Tune", exact: true }).click();
    await main.getByRole("button", { name: "Measure", exact: true }).click();
    await main.getByText("4 KB in 1 file.").waitFor();
    // The Recycle Bin is never picked for you; pick it here.
    await main.getByRole("switch", { name: "Clean Recycle Bin" }).click();
    await main.getByRole("button", { name: "Clean", exact: true }).click();
    await main.getByText("Clean 12 KB?").waitFor();
    await main
      .locator(".dialog-actions")
      .getByRole("button", { name: "Clean" })
      .click();
    await main.getByText("Freed 12 KB.").waitFor();
    assert.ok(
      fs.existsSync(path.join(root, "Temp/today.log")),
      "today's file kept",
    );
    assert.ok(!fs.existsSync(path.join(root, "Temp/old.log")));
    assert.ok(!fs.existsSync(path.join(root, "LocalAppData/D3DSCache/x")));
    assert.ok(
      fs.existsSync(path.join(root, "LocalAppData/D3DSCache")),
      "area folder kept",
    );
    assert.ok(!fs.existsSync(path.join(root, "RecycleBin/$Rdeleted.txt")));
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
}
{
  const { app, call, errors } = await launch(undefined);
  try {
    const t = Date.now();
    const areas = await call("tune.cleanup");
    report = {
      seconds: Math.round((Date.now() - t) / 100) / 10,
      areas: areas.map((a) => [
        a.id,
        Math.round(a.bytes / 1048576) + " MB",
        a.files,
      ]),
    };
    assert.deepEqual(
      areas.map((a) => a.id),
      ["temp", "shaders", "reports", "dumps", "recycle"],
    );
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
}
fs.rmSync(root, { recursive: true, force: true });
console.log(JSON.stringify({ passed: true, realScan: report }));
