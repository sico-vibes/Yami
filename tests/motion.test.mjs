import test from "node:test";
import assert from "node:assert/strict";
import {
  bodyPose,
  REST,
  settle,
  stateEnergy,
  CENTER,
  LAYER_COUNT,
  layerPath,
  layerPoints,
  stepParticles,
} from "../src/yami/motion.ts";
import { migrateState } from "../src/migrations.ts";
test("the flame is deterministic and still when there is no energy", () => {
  for (let layer = 0; layer < LAYER_COUNT; layer++) {
    assert.equal(layerPath(layer, 1.3, 0.6), layerPath(layer, 1.3, 0.6));
    assert.equal(layerPath(layer, 0, 0), layerPath(layer, 9, 0));
    assert.notEqual(layerPath(layer, 0, 0), layerPath(layer, 0.8, 1));
  }
});
test("Yami has a round head and burns downward only, with no limbs", () => {
  for (let layer = 0; layer < LAYER_COUNT; layer++) {
    const points = layerPoints(layer, 2.4, 1);
    const head = points.filter((p) => p.y < CENTER.y - 0.5);
    const radius = Math.hypot(head[0].x - CENTER.x, head[0].y - CENTER.y);
    for (const p of head)
      assert.ok(
        Math.abs(Math.hypot(p.x - CENTER.x, p.y - CENTER.y) - radius) < 0.5,
        "the head stays round",
      );
    for (const p of points)
      assert.ok(
        Math.abs(p.x - CENTER.x) <= radius + 0.5,
        "nothing sticks out sideways",
      );
    assert.ok(Math.max(...points.map((p) => p.y)) > CENTER.y + radius + 5);
  }
});
test("embers spawn, drift and fade out", () => {
  let seed = 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let list = [];
  for (let i = 0; i < 120; i++) list = stepParticles(list, 1 / 60, 6, rand);
  assert.ok(list.length > 0 && list.length <= 10);
  for (let i = 0; i < 240; i++) list = stepParticles(list, 1 / 60, 0, rand);
  assert.equal(list.length, 0);
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
