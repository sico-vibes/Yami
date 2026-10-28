import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { emptyHint, petalsFor, wheelNames } from "../src/wheel/catalog.ts";
import { folderSize, size, zipEntries } from "../electron/wheel/folder.ts";
import { unpackZip } from "../electron/wheel/archive.ts";

test("folders get folder actions only, and Add as project needs one folder", () => {
  const names = wheelNames([{ name: "site", folder: true }]);
  assert.deepEqual(names, ["site/"]);
  const ids = petalsFor(names, "actions").map((p) => p.id);
  assert.deepEqual(ids, [
    "action:copy",
    "action:move",
    "action:path",
    "action:terminal",
    "action:size",
    "action:zip",
    "action:duplicates",
    "action:project",
    "action:icon",
    "action:icon-reset",
  ]);
  const two = petalsFor(["site/", "notes.txt"], "actions").map((p) => p.id);
  assert.ok(!two.includes("action:project"));
  assert.ok(!two.includes("action:icon"));
  assert.ok(!two.includes("action:float"));
  assert.deepEqual(petalsFor(names, "convert"), []);
  assert.deepEqual(petalsFor(names, "tools"), []);
  assert.match(emptyHint("convert", names), /Folders take actions/);
  assert.ok(petalsFor(["a.png"], "actions").some((p) => p.id === "action:float"));
});

test("folder size walks the tree, skips links and zips with its folder name", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-folder-"));
  const site = path.join(root, "site");
  fs.mkdirSync(path.join(site, "css"), { recursive: true });
  fs.writeFileSync(path.join(site, "index.html"), "x".repeat(1000));
  fs.writeFileSync(path.join(site, "css", "a.css"), "y".repeat(24));
  const r = await folderSize(site);
  assert.deepEqual(r, { bytes: 1024, files: 2, partial: false });
  assert.equal((await folderSize(site, 1)).partial, true, "bounded");
  const entries = await zipEntries(site);
  assert.deepEqual(entries.map((e) => e.name).sort(), [
    "site/css/a.css",
    "site/index.html",
  ]);
  await assert.rejects(zipEntries(site, 100), /over 200 MB/);
  const { packZip } = await import("../electron/wheel/archive.ts");
  const round = unpackZip(packZip(entries));
  assert.equal(round.find((e) => e.name === "site/css/a.css").data.toString(), "y".repeat(24));
  assert.equal(size(1536), "2 KB");
  assert.equal(size(17), "17 bytes");
  assert.equal(size(5 * 1024 ** 3), "5.00 GB");
});

test("duplicates are found by content, not by name, and nothing is deleted", async () => {
  const { findDuplicates } = await import("../electron/wheel/folder.ts");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-dupes-"));
  fs.mkdirSync(path.join(root, "a"));
  fs.writeFileSync(path.join(root, "one.txt"), "same bytes");
  fs.writeFileSync(path.join(root, "a", "copy.txt"), "same bytes");
  fs.writeFileSync(path.join(root, "a", "other.txt"), "diff bytes");
  fs.writeFileSync(path.join(root, "empty1"), "");
  fs.writeFileSync(path.join(root, "empty2"), "");
  const { groups, partial } = await findDuplicates(root);
  assert.equal(partial, false);
  assert.equal(groups.length, 1, "same size but different content is not a duplicate; empty files are skipped");
  assert.deepEqual(groups[0].files.map((f) => path.basename(f)).sort(), ["copy.txt", "one.txt"]);
  assert.equal(fs.readdirSync(root).length, 4, "nothing was removed");
});
