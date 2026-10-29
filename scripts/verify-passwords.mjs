// Desktop check for saved logins in the Yami Browser: a fixture CSV (as a
// browser would export it) is imported and then deleted on request, the
// toolbar key fills a local sign-in page, and a fill cannot be asked for
// from outside the browser window. Isolated profile; local test server.
import { _electron } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const port = 47895;
const site = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(
    '<title>Sign in</title><form><input id="u" type="email" placeholder="Email"><input id="p" type="password"><button>Sign in</button></form>',
  );
});
await new Promise((r) => site.listen(port, "127.0.0.1", r));
const profile = path.resolve(".artifacts/passwords-" + Date.now());
skipSetup(profile);
const csv = path.join(profile, "exported-passwords.csv");
fs.writeFileSync(
  csv,
  `name,url,username,password\nlocal,http://127.0.0.1:${port}/,ana@example.test,correct horse\n`,
);
const env = { ...process.env, YAMI_DATA_DIR: profile, YAMI_TEST_CSV: csv };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
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
  await call("modules.set", { id: "browser", enabled: true });
  const imported = await call("vault.passwords", { action: "import" });
  assert.deepEqual([imported.added, imported.total], [1, 1]);
  await call("vault.passwords", { action: "delete-file", file: imported.file });
  assert.equal(fs.existsSync(csv), false, "the plain-text export is deleted");
  await assert.rejects(
    call("vault.passwords", {
      action: "delete-file",
      file: path.join(profile, "data.json"),
    }),
    /Nothing to delete/,
  );
  await call("browser.show", { url: `http://127.0.0.1:${port}/login` });
  let ui;
  for (let i = 0; i < 100 && !ui; i++) {
    ui = app.windows().find((p) => p.url().includes("window=browser"));
    if (!ui) await wait(100);
  }
  const key = ui.getByRole("button", {
    name: /Fill the login for ana@example\.test/,
  });
  await key.waitFor({ timeout: 15000 });
  await assert.rejects(
    call("browser.fill", { id: "anything" }),
    /Choose the login in the browser/,
  );
  await key.click();
  const values = await app.evaluate(async ({ BrowserWindow }, p) => {
    const w = BrowserWindow.getAllWindows().find((b) =>
      b.webContents.getURL().includes("window=browser"),
    );
    const view = w.contentView.children.find((v) =>
      v.webContents.getURL().includes(String(p)),
    );
    for (let i = 0; i < 20; i++) {
      const v = await view.webContents.executeJavaScript("[u.value, p.value]");
      if (v[1]) return v;
      await new Promise((r) => setTimeout(r, 150));
    }
    return view.webContents.executeJavaScript("[u.value, p.value]");
  }, port);
  assert.deepEqual(values, ["ana@example.test", "correct horse"]);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true }));
} finally {
  await app.close();
  site.close();
}
