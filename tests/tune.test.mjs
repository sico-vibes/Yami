import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TuneController } from "../electron/tune/tune.ts";
import { parseRegQuery } from "../electron/tune/registry.ts";
import { tweaks, tuneCategories } from "../src/tune-types.ts";

function fakeRegistry(initial = {}) {
  const values = new Map(Object.entries(initial));
  const keys = new Set([...values.keys()].map((k) => k.split("|")[0]));
  const id = (key, name) => key + "|" + name;
  return {
    values,
    keys,
    writes: [],
    async read(key, name) {
      return values.get(id(key, name)) || null;
    },
    async keyExists(key) {
      return [...keys].some((k) => k === key || k.startsWith(key + "\\"));
    },
    async write(v) {
      this.writes.push(v);
      keys.add(v.key);
      values.set(id(v.key, v.name), { type: v.type, data: v.data });
    },
    async deleteValue(key, name) {
      values.delete(id(key, name));
    },
    async deleteKey(key) {
      for (const k of [...keys])
        if (k === key || k.startsWith(key + "\\")) keys.delete(k);
      for (const k of [...values.keys()])
        if (k.startsWith(key + "|") || k.startsWith(key + "\\"))
          values.delete(k);
    },
  };
}
const file = () =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), "yami-tune-")), "tune.json");
const adv = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced";

test("undo puts back the exact earlier value, or removes what was not set", async () => {
  const reg = fakeRegistry({
    [adv + "|HideFileExt"]: { type: "REG_DWORD", data: "1" },
  });
  const store = file();
  const tune = new TuneController(store, reg);
  let list = await tune.apply(["fileExtensions", "taskbarLeft"]);
  assert.equal(list.find((s) => s.id === "fileExtensions").applied, true);
  assert.deepEqual(await reg.read(adv, "TaskbarAl"), {
    type: "REG_DWORD",
    data: "0",
  });
  // The earlier values reached disk before the registry changed.
  const saved = JSON.parse(fs.readFileSync(store, "utf8")).snapshots;
  assert.deepEqual(saved.fileExtensions.values[0].before, {
    type: "REG_DWORD",
    data: "1",
  });
  assert.equal(saved.taskbarLeft.values[0].before, null);
  // A fresh controller (after a restart) can still undo.
  const again = new TuneController(store, reg);
  list = await again.undo(["fileExtensions", "taskbarLeft"]);
  assert.deepEqual(await reg.read(adv, "HideFileExt"), {
    type: "REG_DWORD",
    data: "1",
  });
  assert.equal(await reg.read(adv, "TaskbarAl"), null);
  assert.ok(list.every((s) => !s.undoable));
});

test("a key Yami created is removed on undo, an existing one is kept", async () => {
  const owned = tweaks.find((t) => t.id === "classicMenu").ownsKey;
  const reg = fakeRegistry();
  const tune = new TuneController(file(), reg);
  await tune.apply(["classicMenu"]);
  assert.equal(await reg.keyExists(owned), true);
  await tune.undo(["classicMenu"]);
  assert.equal(await reg.keyExists(owned), false);

  const kept = fakeRegistry({
    [owned + "|Other"]: { type: "REG_SZ", data: "x" },
  });
  const tune2 = new TuneController(file(), kept);
  await tune2.apply(["classicMenu"]);
  await tune2.undo(["classicMenu"]);
  assert.equal(await kept.keyExists(owned), true);
  assert.deepEqual(await kept.read(owned, "Other"), {
    type: "REG_SZ",
    data: "x",
  });
});

test("an already-set tweak is left alone and has nothing to undo", async () => {
  const reg = fakeRegistry({
    [adv + "|HideFileExt"]: { type: "REG_DWORD", data: "0" },
  });
  const tune = new TuneController(file(), reg);
  const list = await tune.apply(["fileExtensions"]);
  assert.equal(reg.writes.length, 0);
  assert.deepEqual(
    list.find((s) => s.id === "fileExtensions"),
    {
      id: "fileExtensions",
      applied: true,
      undoable: false,
    },
  );
  await assert.rejects(tune.apply(["nope"]), /Unknown tweak/);
  await assert.rejects(tune.undo([]), /Choose tweaks/);
});

test("reg query output parses DWORD, strings and the default value", () => {
  const out = [
    "",
    "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced",
    "    HideFileExt    REG_DWORD    0x1",
    "    LaunchTo    REG_DWORD    0x2",
    "",
  ].join("\r\n");
  assert.deepEqual(parseRegQuery(out, "HideFileExt"), {
    type: "REG_DWORD",
    data: "1",
  });
  assert.equal(parseRegQuery(out, "Missing"), null);
  assert.deepEqual(parseRegQuery("    (Default)    REG_SZ\r\n", ""), {
    type: "REG_SZ",
    data: "",
  });
  assert.deepEqual(parseRegQuery("    Flags    REG_SZ    506\r\n", "Flags"), {
    type: "REG_SZ",
    data: "506",
  });
});

test("the catalogue stays per-user, unique and categorised", () => {
  assert.equal(new Set(tweaks.map((t) => t.id)).size, tweaks.length);
  for (const t of tweaks) {
    assert.ok(tuneCategories.includes(t.category), t.id);
    for (const v of t.values)
      assert.doesNotMatch(v.key, /^HK/, "keys are under HKCU");
  }
});
