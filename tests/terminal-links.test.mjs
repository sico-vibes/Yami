import test from "node:test";
import assert from "node:assert/strict";
import { findPaths } from "../src/terminal-paths.ts";

test("Windows paths in terminal output become links without their punctuation", () => {
  assert.deepEqual(
    findPaths("error in C:\\work\\app\\src\\main.ts:12:4, see docs.").map(
      (p) => p.path,
    ),
    ["C:\\work\\app\\src\\main.ts"],
  );
  assert.deepEqual(
    findPaths("Saved to D:\\out\\report.pdf.").map((p) => p.path),
    ["D:\\out\\report.pdf"],
  );
  assert.deepEqual(
    findPaths("share \\\\nas\\media\\film.mkv ok").map((p) => p.path),
    ["\\\\nas\\media\\film.mkv"],
  );
  const [p] = findPaths("x C:\\a\\b y");
  assert.deepEqual([p.start, p.end], [2, 8]);
  assert.deepEqual(findPaths("no paths, just a:b and C: alone"), []);
});
