// Desktop check for Tune › Disk space. Reads only: lists the real drives,
// measures a sandbox folder with known sizes, and times one measurement of
// your home folder. Nothing is changed or opened in Explorer.
import { _electron } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const stamp = Date.now();
const box = path.resolve(".artifacts/space-sandbox-" + stamp);
const put = (rel, bytes) => {
  fs.mkdirSync(path.dirname(path.join(box, rel)), { recursive: true });
  fs.writeFileSync(path.join(box, rel), Buffer.alloc(bytes));
};
put("big/a.bin", 300_000);
put("big/deep/b.bin", 200_000);
put("small/c.bin", 1000);
put("loose.bin", 50_000);
fs.mkdirSync(path.join(box, "empty"));
put("ünïcode name/d.bin", 10);

const profile = path.resolve(".artifacts/space-verify-" + stamp);
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
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
  await main.getByRole("button", { name: "Tune", exact: true }).click();
  await main.getByRole("button", { name: "Show drives" }).click();
  await main.getByText("C:\\", { exact: true }).waitFor();
  const drives = await call("tune.space.drives");
  assert.ok(drives.some((d) => d.path === "C:\\" && d.total > d.free));
  const view = await call("tune.space", { folder: box });
  assert.equal(view.folder, box);
  assert.equal(view.parent, path.dirname(box));
  assert.deepEqual(
    view.items.map((i) => [i.name, i.dir, i.bytes, i.files]),
    [
      ["big", true, 500_000, 2],
      ["loose.bin", false, 50_000, 1],
      ["small", true, 1000, 1],
      ["ünïcode name", true, 10, 1],
      ["empty", true, 0, 0],
    ],
  );
  assert.equal(view.total, 551_010);
  await assert.rejects(call("tune.space", { folder: "relative" }), /Choose/);
  await assert.rejects(
    call("tune.space", { folder: path.join(box, "missing") }),
    /not on this PC/,
  );
  await assert.rejects(
    call("tune.space.reveal", { folder: box, name: "missing" }),
    /no longer/,
  );
  const t = Date.now();
  const home = await call("tune.space", { folder: os.homedir() });
  const seconds = Math.round((Date.now() - t) / 100) / 10;
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      drives: drives.map((d) => d.path),
      home: {
        seconds,
        entries: home.items.length + home.rest.count,
        gb: Math.round(home.total / 2 ** 30),
      },
    }),
  );
} finally {
  await app.close();
  fs.rmSync(box, { recursive: true, force: true });
}
