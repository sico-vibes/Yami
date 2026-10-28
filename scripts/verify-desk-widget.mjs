// Desktop check for the desk widget: off by default, opens when switched on,
// shows the clock, saves where it was moved, and closes again when switched
// off. Reports the memory the widget's renderer adds. Uses an isolated profile.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/desk-widget-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const widget = () =>
  app.windows().find((p) => p.url().includes("window=widget"));
// Private memory of the whole Electron process tree, in MB.
const privateMb = () =>
  app.evaluate(({ app }) =>
    Math.round(
      app
        .getAppMetrics()
        .reduce((n, m) => n + (m.memory.privateBytes || 0), 0) / 1024,
    ),
  );
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 150 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (m, a) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  assert.equal(
    (await call("state")).settings.deskWidget,
    false,
    "off by default",
  );
  assert.equal(widget(), undefined);
  await wait(3000);
  const before = await privateMb();
  await call("settings", { deskWidget: true });
  let card;
  for (let i = 0; i < 100 && !card; i++) {
    card = widget();
    if (!card) await wait(100);
  }
  assert.ok(card, "the widget window opened");
  await card.locator(".desk-clock").waitFor();
  const clock = await card.locator(".desk-clock").innerText();
  assert.match(clock, /\d{1,2}:\d{2}/);
  assert.equal(
    (await card.locator(".desk-quiet, .desk-media").count()) > 0,
    true,
  );
  // Moving the window saves its spot once the drag settles.
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((b) =>
      b.webContents.getURL().includes("window=widget"),
    );
    w.setPosition(200, 160);
  });
  await wait(1200);
  const saved = JSON.parse(
    fs.readFileSync(path.join(profile, "data.json"), "utf8"),
  );
  assert.equal(saved.settings.deskWidgetAt, "200,160");
  await wait(3000);
  const after = await privateMb();
  // The window is only as tall as the card, so no empty strip takes clicks.
  const fit = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((b) =>
      b.webContents.getURL().includes("window=widget"),
    );
    return w.getSize()[1];
  });
  const cardHeight = await card.evaluate(
    () => document.querySelector(".desk-widget").getBoundingClientRect().height,
  );
  assert.ok(
    Math.abs(fit - Math.max(96, Math.round(cardHeight))) <= 2,
    `${fit} vs ${cardHeight}`,
  );
  // The widget's own renderer process, which is what switching it on adds.
  const own = await app.evaluate(({ app, BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((b) =>
      b.webContents.getURL().includes("window=widget"),
    );
    const pid = w.webContents.getOSProcessId();
    const m = app.getAppMetrics().find((p) => p.pid === pid);
    return Math.round((m?.memory.privateBytes || 0) / 1024);
  });
  await card.screenshot({ path: path.join(profile, "desk-widget.png") });
  await call("settings", { deskWidget: false });
  for (let i = 0; i < 50 && widget(); i++) await wait(100);
  assert.equal(widget(), undefined, "closed when switched off");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      clock,
      windowHeight: fit,
      privateMb: { treeBefore: before, treeAfter: after, widgetRenderer: own },
      screenshot: path.join(profile, "desk-widget.png"),
    }),
  );
} finally {
  await app.close();
}
