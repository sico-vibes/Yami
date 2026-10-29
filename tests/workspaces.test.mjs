import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Workspaces } from "../electron/workspaces.ts";

test("a workspace moves open windows and starts closed apps", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-ws-"));
  const exe = (n) => path.join(dir, n + ".exe");
  for (const n of ["notes", "browser"]) fs.writeFileSync(exe(n), "");
  let live = [
    {
      handle: 1,
      exe: exe("notes"),
      title: "Notes",
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      maximized: false,
    },
    {
      handle: 2,
      exe: exe("browser"),
      title: "Browser",
      x: 10,
      y: 10,
      width: 900,
      height: 700,
      maximized: true,
    },
    {
      handle: 3,
      exe: "C:\\Windows\\explorer.exe",
      title: "Downloads",
      x: 5,
      y: 5,
      width: 600,
      height: 400,
      maximized: false,
    },
  ];
  const placed = [],
    launched = [];
  const native = {
    async call(method, a) {
      if (method === "appWindows") return structuredClone(live);
      if (method === "placeWindow")
        return placed.push([a.handle, a.x, a.width, a.maximized]);
    },
  };
  const ws = new Workspaces(
    path.join(dir, "workspaces.json"),
    native,
    1234,
    (e) => {
      launched.push(e);
      // The app shows its window a moment later.
      setTimeout(
        () =>
          live.push({
            handle: 9,
            exe: e,
            title: "Browser",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            maximized: false,
          }),
        5,
      );
    },
    (ms) => new Promise((r) => setTimeout(r, 10)),
  );
  const saved = await ws.save("  Morning ");
  assert.equal(saved[0].name, "Morning");
  assert.equal(saved[0].windows.length, 3);
  assert.ok(!("handle" in saved[0].windows[0]), "handles are not kept");
  // Later: the browser is closed and explorer's folder window is gone.
  live = [
    {
      handle: 7,
      exe: exe("notes"),
      title: "Notes",
      x: 300,
      y: 300,
      width: 100,
      height: 100,
      maximized: false,
    },
  ];
  const r = await ws.restore(saved[0].id);
  assert.deepEqual(r, { moved: 1, started: 1, missing: ["explorer"] });
  assert.deepEqual(launched, [exe("browser")]);
  assert.deepEqual(placed, [
    [7, 0, 800, false],
    [9, 10, 900, true],
  ]);
  await assert.rejects(ws.restore("nope"), /not saved/);
  assert.deepEqual(ws.remove(saved[0].id), []);
  live = [];
  await assert.rejects(ws.save(""), /No app windows/);
  fs.rmSync(dir, { recursive: true, force: true });
});
