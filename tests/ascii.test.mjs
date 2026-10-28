import test from "node:test";
import assert from "node:assert/strict";
import { revealFrame } from "../src/ascii-reveal.ts";

test("the loading line resolves into its label and keeps spaces", () => {
  const label = "Opening Tune…";
  assert.equal(revealFrame(label, 21), label, "fully revealed at the end");
  const start = revealFrame(label, 0);
  assert.equal(start.length, label.length);
  assert.notEqual(start, label);
  assert.equal(start[7], " ", "spaces stay spaces");
  const half = revealFrame(label, 10);
  assert.ok(half.startsWith("Openi"), half);
});
