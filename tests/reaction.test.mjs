import test from "node:test";
import assert from "node:assert/strict";
import { agentReaction } from "../src/agent-reaction.ts";
import { bodyPose, stateEnergy } from "../src/yami/motion.ts";

test("each agent change reacts once, and the first event only sets a baseline", () => {
  const finished = { id: "s1", phase: "finished", at: 100 };
  let r = agentReaction(finished, undefined);
  assert.equal(r.reaction, "", "nothing on the first event after opening");
  r = agentReaction(finished, r.key);
  assert.equal(r.reaction, "", "the same change is not repeated");
  r = agentReaction({ id: "s1", phase: "error", at: 200 }, r.key);
  assert.equal(r.reaction, "worried");
  r = agentReaction({ id: "s2", phase: "waiting", at: 300 }, r.key);
  assert.equal(r.reaction, "alert");
  r = agentReaction({ id: "s2", phase: "finished", at: 400 }, r.key);
  assert.equal(r.reaction, "cheer");
  r = agentReaction({ id: "s2", phase: "working", at: 500 }, r.key);
  assert.equal(r.reaction, "");
  assert.equal(agentReaction(undefined, "x").reaction, "");
});

test("reactions have their own pose and energy", () => {
  for (const state of ["cheer", "alert", "worried"])
    assert.ok(stateEnergy(state) > 0, state);
  const hop = [0, 0.1, 0.2, 0.3].map((t) => bodyPose("cheer", t, 0.9).bob);
  assert.ok(
    hop.every((b) => b <= 0),
    "cheer only rises",
  );
  assert.ok(Math.min(...hop) < -4, "and rises visibly");
  assert.ok(bodyPose("worried", 0, 0.3).tilt < -7, "worried tilts its head");
  assert.ok(bodyPose("alert", 0, 0.5).ear >= 7, "alert perks its ears");
});
