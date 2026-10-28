import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renamePlan } from "../src/wheel/rename.ts";
import { renameFiles } from "../electron/wheel/rename-files.ts";

test("rename patterns number files in order and keep extensions", () => {
  assert.deepEqual(
    renamePlan(["b.jpg", "a.png"], "trip-{n}").map((p) => p.to),
    ["trip-01.jpg", "trip-02.png"],
  );
  assert.deepEqual(
    renamePlan(["x.txt", "y.txt"], "{name} copy {n}", 9).map((p) => p.to),
    ["x copy 09.txt", "y copy 10.txt"],
  );
  assert.deepEqual(
    renamePlan(["x.txt", "y.txt"], "notes").map((p) => p.to),
    ["notes-01.txt", "notes-02.txt"],
    "a number is added when {n} is missing",
  );
  assert.equal(
    renamePlan(
      Array.from({ length: 120 }, (_, i) => `f${i}.md`),
      "{n}",
      1,
    )[0].to,
    "001.md",
  );
  assert.throws(() => renamePlan(["a.txt"], "bad/name"), /cannot contain/);
  assert.throws(() => renamePlan(["a.txt"], "CON"), /not a usable/);
  assert.throws(() => renamePlan(["a.txt"], "  "), /Type a name pattern/);
});

test("renaming swaps names safely and never overwrites other files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-rename-"));
  const file = (name, text) => {
    fs.writeFileSync(path.join(dir, name), text);
    return { path: path.join(dir, name), name, size: text.length, ext: "txt" };
  };
  // Names that swap with each other: b -> 01, a -> 02 while 01/02 exist.
  const one = file("p-02.txt", "first");
  const two = file("p-01.txt", "second");
  await renameFiles([one, two], "p-{n}");
  assert.equal(fs.readFileSync(path.join(dir, "p-01.txt"), "utf8"), "first");
  assert.equal(fs.readFileSync(path.join(dir, "p-02.txt"), "utf8"), "second");
  const lone = file("lone.txt", "x");
  file("taken-01.txt", "keep me");
  await assert.rejects(renameFiles([lone], "taken-{n}"), /already exists/);
  assert.equal(
    fs.readFileSync(path.join(dir, "taken-01.txt"), "utf8"),
    "keep me",
  );
  assert.ok(fs.existsSync(lone.path), "nothing was renamed");
  assert.ok(
    !fs.readdirSync(dir).some((f) => f.includes(".yami-")),
    "no temporary names left",
  );
});
