// Desktop check for Windows Search results in the launcher: a name that
// Yami's own file index does not cover is found through the Windows index
// under the user's folder, and the launcher refuses to open a path it never
// listed. Nothing is opened. Isolated profile.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const query = process.argv[2] || "claude_desktop_config";
const profile = path.resolve(".artifacts/windows-search-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
  const started = Date.now();
  const found = await call("launcher.files", { query });
  const ms = Date.now() - started;
  assert.ok(
    found.some((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    JSON.stringify(found.slice(0, 3)),
  );
  await assert.rejects(
    call("files.open", { path: "C:\\Windows\\System32\\calc.exe" }),
    /not found/,
  );
  assert.deepEqual(await call("launcher.files", { query: "x" }), []);
  console.log(JSON.stringify({ passed: true, results: found.length, ms }));
} finally {
  await app.close();
}
