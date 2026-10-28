// Desktop check for importing from other browsers: fixture Chrome History
// and Firefox places.sqlite databases (never this PC's real ones, which stay
// untouched) are imported into the Yami Browser's vault, and the new-tab
// page lists them. Isolated profile with LOCALAPPDATA and APPDATA pointed
// at the fixtures.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/history-import-" + Date.now());
skipSetup(profile);
const local = path.join(profile, "fake-local");
const roaming = path.join(profile, "fake-roaming");
const chromeDir = path.join(local, "Google", "Chrome", "User Data", "Default");
fs.mkdirSync(chromeDir, { recursive: true });
const now = Date.now();
{
  const db = new DatabaseSync(path.join(chromeDir, "History"));
  db.exec(
    "CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT, visit_count INTEGER, last_visit_time INTEGER, hidden INTEGER)",
  );
  db.prepare(
    "INSERT INTO urls (url, title, visit_count, last_visit_time, hidden) VALUES (?, ?, 3, ?, 0)",
  ).run(
    "https://fixture-news.example/",
    "Fixture News",
    (now + 11_644_473_600_000) * 1000,
  );
  db.close();
}
const ffProfile = path.join(
  roaming,
  "Mozilla",
  "Firefox",
  "Profiles",
  "t.default",
);
fs.mkdirSync(ffProfile, { recursive: true });
fs.writeFileSync(
  path.join(roaming, "Mozilla", "Firefox", "profiles.ini"),
  "[Profile0]\r\nPath=Profiles/t.default\r\n",
);
{
  const db = new DatabaseSync(path.join(ffProfile, "places.sqlite"));
  db.exec(`CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT, title TEXT, last_visit_date INTEGER, hidden INTEGER DEFAULT 0);
    CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, title TEXT);
    INSERT INTO moz_bookmarks (id, type, parent, title) VALUES (10, 2, 0, 'Reading');`);
  db.prepare(
    "INSERT INTO moz_places (id, url, title, last_visit_date) VALUES (1, ?, ?, ?)",
  ).run("https://fixture-docs.example/", "Fixture Docs", (now - 1000) * 1000);
  db.exec(
    "INSERT INTO moz_bookmarks (id, type, fk, parent, title) VALUES (11, 1, 1, 10, 'Fixture Docs')",
  );
  db.close();
}
const env = {
  ...process.env,
  YAMI_DATA_DIR: profile,
  LOCALAPPDATA: local,
  APPDATA: roaming,
};
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
  const found = (await call("vault.sources"))
    .filter((s) => s.found)
    .map((s) => s.id);
  assert.deepEqual(found, ["chrome", "firefox"]);
  assert.deepEqual(await call("vault.import", { id: "chrome" }), {
    added: 0,
    total: 0,
    history: 1,
  });
  assert.deepEqual(await call("vault.import", { id: "firefox" }), {
    added: 1,
    total: 1,
    history: 1,
  });
  await call("browser.show");
  let ui;
  for (let i = 0; i < 100 && !ui; i++) {
    ui = app.windows().find((p) => p.url().includes("window=browser"));
    if (!ui) await wait(100);
  }
  await ui.getByText("From your other browsers").waitFor({ timeout: 15000 });
  await ui.getByText("Fixture News").waitFor();
  await ui.getByText(/fixture-docs\.example · Firefox/).waitFor();
  assert.ok(
    await ui
      .getByRole("button", { name: "Import from Google Chrome" })
      .isVisible(),
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, found }));
} finally {
  await app.close();
}
