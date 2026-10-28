import test from "node:test";
import assert from "node:assert/strict";
import { activeAgents, errorShownFor } from "../src/agent-rank.ts";

const session = (id, phase, at) => ({
  id,
  agent: "codex",
  project: id,
  cwd: "",
  phase,
  detail: "",
  at,
  source: "hook",
  files: [],
});

test("the island ranks waiting, then recent errors, then working agents", () => {
  const now = 10_000_000;
  const list = activeAgents(
    [
      session("work-old", "working", now - 5000),
      session("done", "finished", now),
      session("think", "thinking", now - 1000),
      session("stale-error", "error", now - errorShownFor - 1),
      session("error", "error", now - 2000),
      session("wait", "waiting", now - 9000),
      session("idle", "idle", now),
    ],
    now,
  );
  assert.deepEqual(
    list.map((s) => s.id),
    ["wait", "error", "think", "work-old"],
  );
  assert.deepEqual(activeAgents([session("done", "finished", now)], now), []);
});
