import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EnvController } from "../electron/tune/env.ts";

function memory(initial) {
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

test("user variables change, announce, and put back exactly", async () => {
  const before = {
    Environment: {
      Path: { type: "REG_EXPAND_SZ", data: "%USERPROFILE%\bin;C:\Tools" },
      TEMP: { type: "REG_EXPAND_SZ", data: "%USERPROFILE%\AppData\Local\Temp" },
      EDITOR: { type: "REG_SZ", data: "code" },
      Count: { type: "REG_DWORD", data: "3" },
    },
  };
  const io = memory(structuredClone(before));
  const undo = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "yami-env-")),
    "u.json",
  );
  let told = 0;
  const env = new EnvController(io, undo, async () => told++);
  let list = await env.list();
  assert.deepEqual(
    list.variables.map((v) => v.name),
    ["EDITOR", "Path", "TEMP"],
    "strings only",
  );
  await assert.rejects(env.set({ name: "bad name", value: "x" }), /letters/);
  await assert.rejects(env.set({ name: "X", value: "a\nb" }), /line breaks/);
  list = await env.set({
    name: "path",
    value: "%USERPROFILE%\bin;C:\Tools;D:\New",
  });
  assert.equal(
    io.keys.get("Environment").Path.type,
    "REG_EXPAND_SZ",
    "type and name kept",
  );
  assert.equal(
    io.keys.get("Environment").Path.data,
    "%USERPROFILE%\bin;C:\Tools;D:\New",
  );
  await env.set({ name: "NEW_ONE", value: "plain" });
  assert.equal(io.keys.get("Environment").NEW_ONE.type, "REG_SZ");
  await env.remove("editor");
  assert.equal(io.keys.get("Environment").EDITOR, undefined);
  list = await env.list();
  assert.deepEqual(list.changed.sort(), ["EDITOR", "NEW_ONE", "Path"]);
  assert.equal(told, 3, "Windows told after each change");
  await env.restore();
  assert.deepEqual(io.keys.get("Environment"), before.Environment);
  await assert.rejects(env.restore(), /not changed/);
});
