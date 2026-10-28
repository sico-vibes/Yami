import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  approvalBytes,
  approvedOn,
  StartupController,
} from "../electron/tune/startup.ts";
import { parseRegValues } from "../electron/tune/registry.ts";

const run = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const approved =
  "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved";

function fakeIo(keys) {
  return {
    keys,
    async list(key) {
      return keys[key] || {};
    },
    async write(v) {
      keys[v.key] = {
        ...keys[v.key],
        [v.name]: { type: v.type, data: v.data },
      };
    },
  };
}

test("approval bytes follow Task Manager's on and off format", () => {
  assert.equal(approvalBytes(true), "020000000000000000000000");
  const off = approvalBytes(false, Date.UTC(2026, 9, 28));
  assert.equal(off.length, 24);
  assert.ok(off.startsWith("03000000"));
  assert.equal(approvedOn({ type: "REG_BINARY", data: off }), false);
  assert.equal(approvedOn({ type: "REG_BINARY", data: "060000000000" }), true);
  assert.equal(approvedOn(undefined), true, "no entry means on");
});

test("startup apps list your entries, folder shortcuts and read-only machine ones", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "yami-startup-"));
  fs.writeFileSync(path.join(folder, "Notes.lnk"), "");
  fs.writeFileSync(path.join(folder, "desktop.ini"), "");
  const io = fakeIo({
    [run]: { Chat: { type: "REG_SZ", data: '"C:\\chat.exe" -m' } },
    [approved + "\\Run"]: {
      Chat: { type: "REG_BINARY", data: approvalBytes(false) },
    },
  });
  const startup = new StartupController(io, folder, async (key) =>
    key.endsWith("CurrentVersion\\Run")
      ? { Driver: { type: "REG_SZ", data: "C:\\driver.exe" } }
      : {},
  );
  let list = await startup.list();
  assert.deepEqual(
    list.map((a) => [a.id, a.enabled, a.editable]),
    [
      ["user:Chat", false, true],
      ["machine:Driver", true, false],
      ["folder:Notes.lnk", true, true],
    ],
  );
  list = await startup.set("user:Chat", true);
  assert.equal(list.find((a) => a.id === "user:Chat").enabled, true);
  list = await startup.set("folder:Notes.lnk", false);
  assert.equal(
    io.keys[approved + "\\StartupFolder"]["Notes.lnk"].type,
    "REG_BINARY",
  );
  assert.equal(list.find((a) => a.id === "folder:Notes.lnk").enabled, false);
  assert.equal(io.keys[run].Chat.data, '"C:\\chat.exe" -m', "the entry stays");
  await assert.rejects(startup.set("machine:Driver", false), /administrator/);
  await assert.rejects(startup.set("user:Gone", false), /gone/);
  await assert.rejects(startup.set("user:Chat", "off"), /on or off/);
});

test("reg query lists every value of a key", () => {
  const out = [
    "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
    '    OneDrive    REG_SZ    "C:\\OneDrive.exe" /background',
    "    Paths    REG_EXPAND_SZ    %LOCALAPPDATA%\\app.exe",
    "",
  ].join("\r\n");
  assert.deepEqual(Object.keys(parseRegValues(out)), ["OneDrive", "Paths"]);
  assert.equal(parseRegValues(out).Paths.type, "REG_EXPAND_SZ");
});
