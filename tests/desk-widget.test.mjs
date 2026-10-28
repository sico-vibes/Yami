import test from "node:test";
import assert from "node:assert/strict";
import { SIZE, MARGIN, widgetSpot } from "../electron/desk-spot.ts";
import { modules } from "../src/modules.ts";
import { defaults } from "../src/default-settings.ts";

const primary = { x: 0, y: 0, width: 1920, height: 1040 };
const second = { x: 1920, y: 0, width: 1280, height: 1000 };

test("the desk widget keeps its spot only while a screen shows it", () => {
  assert.deepEqual(widgetSpot("", [primary]), {
    x: 1920 - SIZE.width - MARGIN,
    y: MARGIN,
  });
  assert.deepEqual(widgetSpot("2000,40", [primary, second]), {
    x: 2000,
    y: 40,
  });
  // The second screen was unplugged: back to the default corner.
  assert.deepEqual(widgetSpot("2000,40", [primary]), widgetSpot("", [primary]));
  assert.deepEqual(
    widgetSpot("nonsense", [primary]),
    widgetSpot("", [primary]),
  );
});

test("the desk widget is an optional module that starts off", () => {
  const spec = modules.find((m) => m.id === "widget");
  assert.equal(spec.setting, "deskWidget");
  assert.equal(defaults.deskWidget, false);
  assert.ok(!spec.presets.includes("essentials"));
});
