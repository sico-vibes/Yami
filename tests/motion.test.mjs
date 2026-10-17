import test from "node:test";
import assert from "node:assert/strict";
import {
  bodyPose,
  REST,
  settle,
  stateEnergy,
  tailPath,
  tailSpine,
} from "../src/yami/motion.ts";
import { migrateState } from "../src/migrations.ts";
test("the tail is deterministic and still when there is no energy", () => {
  assert.equal(tailPath(tailSpine(1.3, 0.6)), tailPath(tailSpine(1.3, 0.6)));
  assert.equal(tailPath(tailSpine(0, 0)), tailPath(tailSpine(9, 0)));
  assert.notEqual(tailPath(tailSpine(0, 0)), tailPath(tailSpine(0.8, 1)));
});
test("idle needs no animation and every pose settles to rest", () => {
  assert.equal(stateEnergy("idle"), 0);
  assert.equal(stateEnergy("sleeping"), 0);
  assert.ok(stateEnergy("speaking") > 0);
  const pose = bodyPose("speaking", 2.1, 1);
  let frames = 0;
  while (!settle(pose) && frames < 600) frames++;
  assert.ok(frames < 600);
  assert.deepEqual(pose, REST);
});
test("saved Hitodama souls migrate to Yami and keep other data", () => {
  const state = migrateState({
    owned: ["hitodama", "Charon", "yami", "ember"],
    settings: { soul: "hitodama", name: "Sam" },
    messages: [{ role: "user", text: "hi" }],
  });
  assert.equal(state.settings.soul, "yami");
  assert.deepEqual(state.owned, ["yami", "Charon", "ember"]);
  assert.equal(state.settings.name, "Sam");
  assert.equal(state.messages.length, 1);
  assert.equal(
    migrateState({ settings: { soul: "void" } }).settings.soul,
    "void",
  );
});
