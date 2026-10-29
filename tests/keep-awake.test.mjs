import test from "node:test";
import assert from "node:assert/strict";
import { KeepAwake } from "../electron/keep-awake.ts";

/** Records what Electron's power-save blocker would be asked. */
function blocker() {
  const live = new Map();
  let next = 1;
  return {
    live,
    start(type) {
      live.set(next, type);
      return next++;
    },
    stop(id) {
      live.delete(id);
    },
  };
}

test("keep awake holds one blocker, switches modes and ends on time", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  const b = blocker();
  const events = [];
  const awake = new KeepAwake(b, (s) => events.push(s));
  assert.throws(() => awake.set({ minutes: 7 }), /how long/);
  let s = awake.set({ minutes: 0 });
  assert.deepEqual(s, { on: true, screen: false, until: 0 });
  assert.deepEqual([...b.live.values()], ["prevent-app-suspension"]);
  s = awake.set({ minutes: 30, screen: true });
  assert.deepEqual(
    [...b.live.values()],
    ["prevent-display-sleep"],
    "the old blocker is released",
  );
  assert.equal(s.until, 1_000_000 + 30 * 60_000);
  t.mock.timers.tick(30 * 60_000);
  assert.equal(b.live.size, 0, "ended after 30 minutes");
  assert.deepEqual(awake.status(), { on: false, screen: false, until: 0 });
  assert.equal(events.at(-1).on, false, "windows are told");
  awake.set({ minutes: 60 });
  awake.stop();
  t.mock.timers.tick(60 * 60_000);
  assert.equal(b.live.size, 0);
  assert.equal(
    events.filter((e) => !e.on).length,
    2,
    "the cancelled timer did not fire",
  );
});
