import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CursorController,
  cursorRoles,
  baseSize,
} from "../electron/tune/cursors.ts";

/** An in-memory HKCU with the same calls as reg.exe access. */
function memoryRegistry(initial) {
  const keys = new Map(Object.entries(initial).map(([k, v]) => [k, { ...v }]));
  const named = (n) => n || "(Default)";
  return {
    keys,
    async read(key, name) {
      return keys.get(key)?.[named(name)] || null;
    },
    async keyExists(key) {
      return keys.has(key);
    },
    async write(v) {
      if (!keys.has(v.key)) keys.set(v.key, {});
      keys.get(v.key)[named(v.name)] = { type: v.type, data: v.data };
    },
    async deleteValue(key, name) {
      delete keys.get(key)?.[named(name)];
    },
    async deleteKey(key) {
      keys.delete(key);
    },
    async list(key) {
      return { ...(keys.get(key) || {}) };
    },
  };
}

const machine = async () => ({
  "Windows Aero": {
    type: "REG_EXPAND_SZ",
    data: "%SystemRoot%\\cursors\\aero_arrow.cur,%SystemRoot%\\cursors\\aero_helpsel.cur",
  },
  "Windows Black": {
    type: "REG_EXPAND_SZ",
    data: cursorRoles.map((r) => `%SystemRoot%\\cursors\\${r}_r.cur`).join(","),
  },
});

test("a pointer scheme and size apply, then put back exactly", async () => {
  const before = {
    "Control Panel\\Cursors": {
      "(Default)": { type: "REG_SZ", data: "Windows Default" },
      Arrow: { type: "REG_SZ", data: "C:\\WINDOWS\\cursors\\aero_arrow.cur" },
      CursorBaseSize: { type: "REG_DWORD", data: "32" },
      "Scheme Source": { type: "REG_DWORD", data: "2" },
      ContactVisualization: { type: "REG_DWORD", data: "1" },
    },
    "Control Panel\\Cursors\\Schemes": {
      Mine: { type: "REG_EXPAND_SZ", data: "C:\\Mine\\a.cur" },
    },
  };
  const io = memoryRegistry(structuredClone(before));
  const undo = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "yami-cur-")),
    "u.json",
  );
  let reloads = 0;
  const c = new CursorController(io, machine, undo, async () => reloads++);
  let status = await c.status();
  assert.deepEqual(
    status.schemes.map((s) => s.name),
    ["Windows Default", "Mine", "Windows Black"],
  );
  assert.equal(status.current, "Windows Default");
  assert.equal(status.size, 1);
  assert.equal(status.saved, false);
  await assert.rejects(c.apply({ scheme: "system:Nope" }), /scheme/);
  await assert.rejects(c.apply({ size: 16 }), /1 to 15/);
  status = await c.apply({ scheme: "system:Windows Black", size: 3 });
  const now = io.keys.get("Control Panel\\Cursors");
  assert.equal(now.Arrow.data, "%SystemRoot%\\cursors\\Arrow_r.cur");
  assert.equal(now.Arrow.type, "REG_EXPAND_SZ");
  assert.equal(now.Person.data, "%SystemRoot%\\cursors\\Person_r.cur");
  assert.equal(now.CursorBaseSize.data, String(baseSize(3)));
  assert.equal(
    io.keys.get("Software\\Microsoft\\Accessibility").CursorSize.data,
    "3",
  );
  assert.deepEqual(
    [status.current, status.size, status.saved],
    ["Windows Black", 3, true],
  );
  // A user scheme is source 1, and the first snapshot is kept.
  await c.apply({ scheme: "user:Mine" });
  assert.equal(
    io.keys.get("Control Panel\\Cursors")["Scheme Source"].data,
    "1",
  );
  assert.equal(io.keys.get("Control Panel\\Cursors").Help.data, "");
  status = await c.restore();
  assert.deepEqual(
    io.keys.get("Control Panel\\Cursors"),
    before["Control Panel\\Cursors"],
  );
  assert.equal(
    io.keys.get("Software\\Microsoft\\Accessibility").CursorSize,
    undefined,
  );
  assert.equal(status.saved, false);
  assert.equal(reloads, 3);
  await assert.rejects(c.restore(), /not changed/);
});
