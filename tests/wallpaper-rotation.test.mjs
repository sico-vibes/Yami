import test from "node:test";
import assert from "node:assert/strict";
import {
  createWallpaperRotation,
  nextWallpaper,
  rotationDelay,
} from "../electron/wallpaper-rotation.ts";

test("the next wallpaper follows the library and skips missing files", () => {
  const all = () => true;
  assert.equal(nextWallpaper(["a", "b", "c"], "a", all), "b");
  assert.equal(nextWallpaper(["a", "b", "c"], "c", all), "a");
  assert.equal(
    nextWallpaper(["a", "b", "c"], "a", (f) => f !== "b"),
    "c",
  );
  assert.equal(nextWallpaper(["a", "b"], "elsewhere", all), "a");
  assert.equal(nextWallpaper(["a"], "a", all), "");
  assert.equal(rotationDelay(1000, 0, 5000), 0);
  assert.equal(rotationDelay(1000, 4800, 5000), 800);
});

test("rotation keeps one timer and changes the wallpaper when it fires", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  const set = [];
  let saved = 0;
  const store = {
    state: {
      wallpapers: ["C:\\w\\1.jpg", "C:\\w\\2.jpg", "C:\\w\\3.jpg"],
      currentWallpaper: "C:\\w\\1.jpg",
      settings: { wallpaperRotate: "hourly", wallpaperRotatedAt: 0 },
    },
  };
  const rotation = createWallpaperRotation({
    store,
    native: { call: async (m, a) => set.push([m, a.path]) },
    changed: () => saved++,
    exists: () => true,
  });
  rotation.sync();
  assert.equal(
    store.state.settings.wallpaperRotatedAt,
    1_000_000,
    "the clock starts now",
  );
  t.mock.timers.tick(59 * 60_000);
  assert.deepEqual(set, [], "nothing before an hour");
  t.mock.timers.tick(60_000);
  return new Promise((resolve) => setImmediate(resolve)).then(() => {
    assert.deepEqual(set, [["wallpaperSet", "C:\\w\\2.jpg"]]);
    assert.equal(store.state.currentWallpaper, "C:\\w\\2.jpg");
    assert.equal(saved, 1);
    store.state.settings.wallpaperRotate = "off";
    rotation.sync();
    t.mock.timers.tick(2 * 60 * 60_000);
    assert.equal(set.length, 1, "off stops it");
    rotation.dispose();
  });
});
