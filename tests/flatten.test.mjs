import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { flattenFolder, flattenPlan } from "../electron/wheel/flatten.ts";

test("flatten moves files up, renames clashes and removes emptied folders", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-flatten-"));
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  put("photo.jpg", "top");
  put("2024/photo.jpg", "a");
  put("2024/june/photo.jpg", "b");
  put("2024/june/notes.txt", "c");
  put("misc/readme.md", "d");
  fs.mkdirSync(path.join(root, "empty-already"));
  const plan = flattenPlan(root);
  assert.deepEqual(
    plan.moves.map((m) => [path.relative(root, m.from), path.basename(m.to)]),
    [
      [path.join("2024", "june", "notes.txt"), "notes.txt"],
      [path.join("2024", "june", "photo.jpg"), "photo (2).jpg"],
      [path.join("2024", "photo.jpg"), "photo (3).jpg"],
      [path.join("misc", "readme.md"), "readme.md"],
    ],
  );
  await flattenFolder(root);
  assert.deepEqual(fs.readdirSync(root).sort(), [
    "notes.txt",
    "photo (2).jpg",
    "photo (3).jpg",
    "photo.jpg",
    "readme.md",
  ]);
  assert.equal(
    fs.readFileSync(path.join(root, "photo.jpg"), "utf8"),
    "top",
    "never overwritten",
  );
  assert.equal(fs.readFileSync(path.join(root, "photo (2).jpg"), "utf8"), "b");
  await assert.rejects(flattenFolder(root), /nothing in subfolders/);
  fs.rmSync(root, { recursive: true, force: true });
});
