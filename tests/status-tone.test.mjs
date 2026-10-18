import test from "node:test";
import assert from "node:assert/strict";
import { statusTone } from "../src/status-tone.ts";
test("status words map to one colour family each", () => {
  const cases = {
    working: "active",
    thinking: "active",
    "Connecting…": "active",
    waiting: "attention",
    "needs-auth": "attention",
    stale: "attention",
    finished: "good",
    fresh: "good",
    Ready: "good",
    "Windows connected": "good",
    Enabled: "good",
    unavailable: "problem",
    error: "problem",
    "Not connected": "quiet",
    idle: "quiet",
    "something new": "quiet",
  };
  for (const [word, tone] of Object.entries(cases))
    assert.equal(statusTone(word), tone, word);
});
