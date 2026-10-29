import test from "node:test";
import assert from "node:assert/strict";
import { paletteItems } from "../src/palette.ts";
import { defaults as defaultSettings } from "../src/default-settings.ts";

test("snap commands in the launcher name a layout for the last window", () => {
  const ids = (q) =>
    paletteItems(q, defaultSettings)
      .filter((i) => i.id.startsWith("snap:"))
      .map((i) => i.id);
  assert.deepEqual(ids("snap left"), [
    "snap:left",
    "snap:top-left",
    "snap:bottom-left",
    "snap:left-third",
    "snap:left-two-thirds",
  ]);
  assert.deepEqual(ids("snap top right"), ["snap:top-right"]);
  assert.deepEqual(ids("arrange centre"), ["snap:center-third", "snap:center"]);
  assert.deepEqual(ids("snap maximised"), ["snap:maximize"]);
  assert.deepEqual(ids("left"), [], "only after snap, arrange or move window");
  const item = paletteItems("snap right half", defaultSettings).find(
    (i) => i.id === "snap:right",
  );
  assert.deepEqual(item.run, {
    method: "window.snap",
    args: { layout: "right" },
  });
});
