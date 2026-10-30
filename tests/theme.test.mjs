import test from "node:test";
import assert from "node:assert/strict";
import { darkAt, nextSwitch } from "../src/theme-schedule.ts";

const at = (h, m = 0) => new Date(2026, 9, 28, h, m);

test("dark covers the evening and night, light the day", () => {
  assert.equal(darkAt(at(12), "07:00", "19:00"), false);
  assert.equal(darkAt(at(19), "07:00", "19:00"), true);
  assert.equal(darkAt(at(3), "07:00", "19:00"), true);
  assert.equal(darkAt(at(7), "07:00", "19:00"), false);
  // A night worker: dark in the day.
  assert.equal(darkAt(at(12), "20:00", "08:00"), true);
  assert.equal(darkAt(at(22), "20:00", "08:00"), false);
  assert.throws(() => darkAt(at(1), "7am", "19:00"), /07:30/);
});

test("the next switch is the nearer of the two times, wrapping past midnight", () => {
  assert.deepEqual(nextSwitch(at(12), "07:00", "19:00"), {
    at: at(19),
    dark: true,
  });
  const night = nextSwitch(at(23), "07:00", "19:00");
  assert.equal(night.dark, false);
  assert.equal(night.at.getDate(), 29);
  assert.equal(night.at.getHours(), 7);
  assert.equal(
    nextSwitch(at(19), "07:00", "19:00").dark,
    false,
    "exactly at 19:00 the next is morning",
  );
});
