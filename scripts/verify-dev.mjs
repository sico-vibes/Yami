import { createServer } from "vite";
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";
const server = await createServer({ server: { port: 5173 } });
await server.listen();
const env = {
  ...process.env,
  YAMI_DEV_URL: "http://127.0.0.1:5173",
  YAMI_DATA_DIR: path.resolve(".artifacts/development-check"),
};
delete env.ELECTRON_RUN_AS_NODE;
skipSetup(env.YAMI_DATA_DIR);
let app;
try {
  app = await _electron.launch({ args: [path.resolve(".")], env });
  await app.firstWindow();
  let page;
  for (let i = 0; i < 50; i++) {
    page = app.windows().find((p) => p.url().includes("window=main"));
    if (page) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector(".bottom-dock");
  assert.equal(
    (await page.evaluate(() => window.yami.invoke("diagnostics"))).native.ok,
    true,
  );
  await page.evaluate(() =>
    window.yami.invoke("settings", { clipboardEnabled: false }),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: development server, React refresh preamble, preload and native IPC.",
  );
} finally {
  await app?.close();
  await server.close();
}
