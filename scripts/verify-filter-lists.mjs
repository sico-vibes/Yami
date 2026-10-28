// Desktop check for the Yami Browser's full filter lists. It downloads the
// real EasyList and EasyPrivacy from easylist.to (about 3 MB, read only),
// then loads a local test page whose ad script and ad box (EasyList's
// generic `##.ad-slot`) the lists cover:
// the script must be cancelled before it leaves the PC and the box hidden.
// Reports the download-and-build time and the main process's memory.
import { _electron } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/filters-verify-" + Date.now());
skipSetup(profile);
const page = `<title>ad test</title>
<div class="ad-slot" id="slot">ad</div><p class="story">story</p>
<script>
  // An ad network script that only EasyList names (not the built-in list).
  fetch("https://pagead2.googlesyndication.com/pagead/show_ads_impl.js").then(
    () => (document.title = "ad reached"),
    () => (document.title = "ad blocked"),
  );
</script>`;
const site = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(page);
});
await new Promise((r) => site.listen(47897, "127.0.0.1", r));
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mainMb = () =>
  app.evaluate(({ app }) => {
    const m = app.getAppMetrics().find((p) => p.type === "Browser");
    return Math.round((m?.memory.privateBytes || 0) / 1024);
  });
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  await call("modules.set", { id: "browser", enabled: true });
  assert.equal((await call("browser.filters")).installed, false);
  const before = await mainMb();
  const started = Date.now();
  const status = await call("browser.filters.update");
  const buildMs = Date.now() - started;
  assert.equal(status.error, undefined, status.error);
  assert.ok(status.rules > 30000, `rules: ${status.rules}`);
  const after = await mainMb();
  // A *.localhost name: Chromium sends it to this PC, and unlike a bare IP
  // it has a domain, which site and generic hiding rules need.
  await call("browser.show", { url: "http://news.localhost:47897/" });
  let title = "";
  for (let i = 0; i < 60 && !/^ad (blocked|reached)$/.test(title); i++) {
    await wait(250);
    title =
      (await call("browser.state")).tabs.find((t) => t.url.includes("47897"))
        ?.title || "";
  }
  assert.equal(title, "ad blocked", "EasyList cancelled the ad script");
  // The ad box is hidden by the lists' CSS; the story is not.
  const shown = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((b) =>
      b.webContents.getURL().includes("window=browser"),
    );
    const view = w.contentView.children.find((v) =>
      v.webContents.getURL().includes("47897"),
    );
    for (let i = 0; i < 20; i++) {
      const r = await view.webContents.executeJavaScript(
        "[getComputedStyle(slot).display, getComputedStyle(document.querySelector('.story')).display]",
      );
      if (r[0] === "none") return r;
      await new Promise((d) => setTimeout(d, 200));
    }
    return view.webContents.executeJavaScript(
      "[getComputedStyle(slot).display, getComputedStyle(document.querySelector('.story')).display]",
    );
  });
  assert.deepEqual(shown, ["none", "block"]);
  const removed = await call("browser.filters.remove");
  assert.equal(removed.installed, false);
  assert.equal(fs.existsSync(path.join(profile, "filters")), false);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      rules: status.rules,
      megabytes: +(
        status.lists.reduce((n, l) => n + l.bytes, 0) / 1048576
      ).toFixed(1),
      downloadAndBuildMs: buildMs,
      mainProcessMb: { before, after },
    }),
  );
} finally {
  await app.close();
  site.close();
}
