import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { HostsController, parseHosts } from "../electron/tune/hosts.ts";

const sample = [
  "# Copyright (c) Microsoft Corp.",
  "# localhost name resolution is handled within DNS itself.",
  "#\t127.0.0.1       localhost",
  "127.0.0.1 dev.local api.dev.local # my apps",
  "0.0.0.0 ads.example.com",
  "not an entry",
  "",
].join("\r\n");

test("hosts lines are read with their on or off state", () => {
  assert.deepEqual(parseHosts(sample), [
    { line: 2, ip: "127.0.0.1", names: ["localhost"], on: false },
    {
      line: 3,
      ip: "127.0.0.1",
      names: ["dev.local", "api.dev.local"],
      on: true,
    },
    { line: 4, ip: "0.0.0.0", names: ["ads.example.com"], on: true },
  ]);
});

test("changes keep the rest of the file and put back restores it exactly", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-hosts-"));
  const file = path.join(dir, "hosts");
  fs.writeFileSync(file, sample);
  const writes = [];
  const hosts = new HostsController(
    file,
    path.join(dir, "original.txt"),
    async (prepared) => {
      writes.push(fs.readFileSync(prepared, "utf8"));
      fs.copyFileSync(prepared, file);
    },
  );
  await assert.rejects(hosts.add("999.1.1.1", "x.example.com"), /address/);
  await assert.rejects(hosts.add("0.0.0.0", "bad name"), /host name/);
  let r = await hosts.add("0.0.0.0", "Tracker.Example.net");
  assert.deepEqual(r.entries.at(-1), {
    line: 6,
    ip: "0.0.0.0",
    names: ["tracker.example.net"],
    on: true,
  });
  assert.ok(
    fs.readFileSync(file, "utf8").includes("\r\n"),
    "Windows line endings kept",
  );
  r = await hosts.toggle(4, false);
  assert.equal(r.entries.find((e) => e.line === 4).on, false);
  r = await hosts.toggle(4, true);
  assert.equal(r.entries.find((e) => e.line === 4).on, true);
  await assert.rejects(hosts.remove(5), /changed/);
  r = await hosts.remove(3);
  assert.ok(!r.entries.some((e) => e.names.includes("dev.local")));
  assert.equal(r.changed, true);
  r = await hosts.restore();
  assert.equal(fs.readFileSync(file, "utf8"), sample, "exactly as before");
  assert.equal(r.changed, false);
  await assert.rejects(hosts.restore(), /not changed/);
  assert.equal(writes.length, 5);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the elevated script refuses a prepared file with other lines", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-hosts-ps-"));
  const bad = path.join(dir, "bad.txt");
  fs.writeFileSync(bad, "127.0.0.1 fine.local\r\nrm -rf /\r\n");
  let out = "";
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.resolve("native/Admin.ps1"),
        "-Mode",
        "hosts",
        "-Source",
        bad,
      ],
      { encoding: "utf8", windowsHide: true },
    );
  } catch (e) {
    out = String(e.stdout);
  }
  assert.match(out, /Not a hosts line: rm -rf/);
  fs.rmSync(dir, { recursive: true, force: true });
});
