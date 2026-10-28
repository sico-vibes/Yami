import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Vault } from "../electron/browser/vault.ts";

// Chromium stores microseconds since 1601; Firefox since 1970.
const chromium = (ms) => (ms + 11_644_473_600_000) * 1000;
const day = Date.UTC(2026, 9, 27);

function chromeHistory(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT, visit_count INTEGER, last_visit_time INTEGER, hidden INTEGER)",
  );
  const add = db.prepare(
    "INSERT INTO urls (url, title, visit_count, last_visit_time, hidden) VALUES (?, ?, 1, ?, ?)",
  );
  add.run("https://news.ycombinator.com/", "Hacker News", chromium(day), 0);
  add.run("https://older.example/", "Older", chromium(day - 86400_000), 0);
  add.run("chrome://settings/", "Settings", chromium(day), 0);
  add.run("https://hidden.example/", "Hidden", chromium(day), 1);
  db.close();
}

function firefoxPlaces(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT, title TEXT, last_visit_date INTEGER, hidden INTEGER DEFAULT 0);
    CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, title TEXT);`);
  db.prepare(
    "INSERT INTO moz_places (id, url, title, last_visit_date) VALUES (1, ?, ?, ?)",
  ).run("https://developer.mozilla.org/", "MDN", day * 1000);
  db.prepare(
    "INSERT INTO moz_places (id, url, title, last_visit_date) VALUES (2, ?, ?, NULL)",
  ).run("https://kyoto.example/", "Kyoto trip");
  db.exec(
    "INSERT INTO moz_bookmarks (id, type, fk, parent, title) VALUES (10, 2, NULL, 0, 'Travel'), (11, 1, 2, 10, 'Kyoto trip')",
  );
  db.close();
}

test("history and Firefox bookmarks import into the encrypted vault, newest first", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-history-"));
  const local = path.join(root, "Local"),
    roaming = path.join(root, "Roaming");
  chromeHistory(
    path.join(local, "Google", "Chrome", "User Data", "Default", "History"),
  );
  const ff = path.join(roaming, "Mozilla", "Firefox");
  firefoxPlaces(
    path.join(ff, "Profiles", "abc.default-release", "places.sqlite"),
  );
  fs.writeFileSync(
    path.join(ff, "profiles.ini"),
    "[Install1]\r\nDefault=Profiles/abc.default-release\r\n\r\n[Profile0]\r\nPath=Profiles/abc.default-release\r\n",
  );
  const crypto = {
    encrypt: (t) => Buffer.from("enc:" + t),
    decrypt: (b) => b.toString().slice(4),
    available: () => true,
  };
  const vault = new Vault(path.join(root, "vault.bin"), crypto);
  const found = Object.fromEntries(
    vault.sources(local, roaming).map((s) => [s.id, s.found]),
  );
  assert.equal(found.chrome, true);
  assert.equal(found.firefox, true);
  assert.equal(found.edge, false);
  assert.deepEqual(vault.import("chrome", local, roaming), {
    added: 0,
    total: 0,
    history: 2,
  });
  assert.deepEqual(vault.import("firefox", local, roaming), {
    added: 1,
    total: 1,
    history: 1,
  });
  assert.deepEqual(
    vault.history().map((v) => [v.title, v.from]),
    [
      ["Hacker News", "Google Chrome"],
      ["MDN", "Firefox"],
      ["Older", "Google Chrome"],
    ],
  );
  assert.equal(vault.history()[0].at, day);
  assert.deepEqual(
    vault.list().map((b) => [b.title, b.folder]),
    [["Kyoto trip", "Travel"]],
  );
  // Stored encrypted, and read back after a restart.
  assert.match(fs.readFileSync(path.join(root, "vault.bin"), "utf8"), /^enc:/);
  assert.equal(
    new Vault(path.join(root, "vault.bin"), crypto).history().length,
    3,
  );
  assert.deepEqual(vault.clearHistory(), []);
  assert.throws(
    () => vault.import("edge", local, roaming),
    /no bookmarks or history/,
  );
  assert.ok(
    !fs
      .readdirSync(os.tmpdir())
      .some(
        (d) =>
          d.startsWith("yami-import-") &&
          fs.existsSync(path.join(os.tmpdir(), d, "copy.sqlite")),
      ),
    "temporary copies removed",
  );
  fs.rmSync(root, { recursive: true, force: true });
});
