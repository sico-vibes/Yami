import test from "node:test";
import assert from "node:assert/strict";
import {
  ModuleRegistry,
  validPacks,
  workbenchDuties,
} from "../electron/modules/registry.ts";
import { setupDoneForExisting } from "../src/migrations.ts";
import { modules, presetSelection } from "../src/modules.ts";

function harness(settings = {}) {
  const log = { loads: 0, disposed: [], events: [], saves: 0 };
  const state = {
    workbenchEnabled: true,
    fileWheelEnabled: false,
    clipboardEnabled: true,
    weatherEnabled: false,
    roam: false,
    ...settings,
  };
  let meeting = false;
  const registry = new ModuleRegistry({
    settings: () => state,
    save: () => {
      log.saves++;
    },
    broadcast: (event) => log.events.push(event),
    packs: () => [
      { id: "ffmpeg", version: "1", license: "GPL", state: "installed" },
      { id: "magick", version: "1", license: "IM", state: "missing" },
    ],
    loaders: {
      workbench: {
        load: () => ({ id: ++log.loads }),
        dispose: (instance) => log.disposed.push(instance.id),
        busy: () => (meeting ? "Recording." : undefined),
      },
    },
  });
  return { registry, state, log, setMeeting: (v) => (meeting = v) };
}

test("modules load on first use only while enabled", () => {
  const { registry, log } = harness();
  assert.equal(registry.loaded("workbench"), false);
  assert.equal(registry.list().find((m) => m.id === "workbench").loaded, false);
  const first = registry.get("workbench");
  assert.equal(registry.get("workbench"), first);
  assert.equal(log.loads, 1);
  assert.equal(registry.list().find((m) => m.id === "workbench").loaded, true);
  assert.equal(log.events.at(-1).type, "modules");
  assert.throws(
    () => registry.get("fileWheel"),
    /File wheel is turned off\. Turn it on in Settings › Modules\./,
  );
});

test("setting-only modules report loaded when on, and carry their packs", () => {
  const { registry } = harness();
  const list = registry.list();
  assert.deepEqual(
    list.map((m) => m.id),
    modules.map((m) => m.id),
  );
  assert.equal(list.find((m) => m.id === "clipboard").loaded, true);
  assert.equal(list.find((m) => m.id === "weather").loaded, false);
  assert.deepEqual(
    list.find((m) => m.id === "fileWheel").packs.map((p) => p.id),
    ["ffmpeg", "magick"],
  );
  assert.deepEqual(list.find((m) => m.id === "roam").packs, []);
});

test("switching a module off disposes it, saves and broadcasts", async () => {
  const { registry, state, log } = harness();
  registry.get("workbench");
  const events = log.events.length;
  const list = await registry.set("workbench", false);
  assert.equal(state.workbenchEnabled, false);
  assert.deepEqual(log.disposed, [1]);
  assert.equal(log.saves, 1);
  assert.equal(list.find((m) => m.id === "workbench").enabled, false);
  assert.equal(log.events.length, events + 1);
  await registry.set("workbench", true);
  assert.equal(registry.loaded("workbench"), false);
  registry.get("workbench");
  assert.equal(log.loads, 2);
});

test("sync disposes modules switched off through general settings", () => {
  const { registry, state, log } = harness();
  registry.get("workbench");
  state.workbenchEnabled = false;
  registry.sync();
  assert.deepEqual(log.disposed, [1]);
  assert.equal(registry.peek("workbench"), undefined);
});

test("bad requests change nothing", async () => {
  const { registry, state, log, setMeeting } = harness();
  await assert.rejects(registry.set("nope", true), /Unknown module/);
  await assert.rejects(registry.set("roam", "yes"), /Choose on or off/);
  await assert.rejects(
    registry.apply({ roam: true, weather: 1 }),
    /Choose on or off for Weather/,
  );
  assert.equal(state.roam, false);
  registry.get("workbench");
  setMeeting(true);
  await assert.rejects(registry.set("workbench", false), /Recording/);
  assert.equal(state.workbenchEnabled, true);
  assert.equal(log.saves, 0);
});

test("apply switches a whole setup choice and runs the extra step", async () => {
  const { registry, state } = harness();
  let done = false;
  await registry.apply(presetSelection("everything"), () => (done = true));
  assert.equal(done, true);
  for (const m of modules) assert.equal(state[m.setting], true);
});

test("packs are validated against the catalogue", () => {
  assert.deepEqual(validPacks(undefined), []);
  assert.deepEqual(validPacks(["ffmpeg", "ffmpeg", "magick"]), [
    "ffmpeg",
    "magick",
  ]);
  assert.throws(() => validPacks(["not-a-pack"]), /Unknown download/);
  assert.deepEqual(validPacks(["needle", "whistle"]), ["needle", "whistle"]);
  assert.throws(() => validPacks("ffmpeg"), /list/);
});

test("the workspace starts early only for background duties", () => {
  assert.equal(workbenchDuties({}, [], true), false);
  assert.equal(workbenchDuties({ monitor: true }, [], true), true);
  assert.equal(workbenchDuties({ usageBackground: true }, [], true), true);
  assert.equal(workbenchDuties({ terminalShortcut: "Ctrl+`" }, [], true), true);
  assert.equal(
    workbenchDuties({ terminalShortcut: "Ctrl+`" }, [], false),
    false,
  );
  assert.equal(
    workbenchDuties({}, [{ enabled: true, background: false }], true),
    false,
  );
  assert.equal(
    workbenchDuties({}, [{ enabled: true, background: true }], true),
    true,
  );
});

test("existing profiles skip first-run setup; new ones keep it", () => {
  assert.deepEqual(setupDoneForExisting({ soul: "yami" }), {
    soul: "yami",
    setupDone: true,
  });
  assert.equal(setupDoneForExisting(undefined), undefined);
  assert.deepEqual(setupDoneForExisting({ setupDone: false }), {
    setupDone: false,
  });
  const saved = { setupDone: true, roam: true };
  assert.equal(setupDoneForExisting(saved), saved);
});
