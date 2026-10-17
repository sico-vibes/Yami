import { spawn, execFileSync } from "node:child_process";
import readline from "node:readline";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
fs.mkdirSync(".artifacts", { recursive: true });
execFileSync(
  "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe",
  [
    "/nologo",
    "/target:exe",
    "/r:System.Windows.Forms.dll",
    "/r:System.Drawing.dll",
    "/out:" + path.resolve(".artifacts/Fixture.exe"),
    path.resolve("tests/Fixture.cs"),
  ],
  { stdio: "inherit" },
);
const fixture = spawn(path.resolve(".artifacts/Fixture.exe"), [], {
    windowsHide: false,
  }),
  host = spawn(path.resolve("native/bin/Yami.Native.exe"), [], {
    windowsHide: true,
  });
let id = 0;
const pending = new Map(),
  events = [],
  output = [];
const reader = readline.createInterface({ input: host.stdout });
reader.on("line", (l) => {
  const r = JSON.parse(l);
  if (r.eventName) events.push(r);
  const p = pending.get(r.id);
  if (p) {
    pending.delete(r.id);
    r.error ? p.reject(new Error(r.error)) : p.resolve(r.result);
  }
});
fixture.stdout.on("data", (d) => output.push(d.toString()));
const call = (method, args = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    host.stdin.write(JSON.stringify({ id: n, method, args }) + "\n");
  });
try {
  await call("configure", { hotkeys: false });
  let window;
  for (let i = 0; i < 50; i++) {
    window = (await call("windows")).find(
      (w) => w.title === "Yami input verification",
    );
    if (window) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(window, "Fixture window must appear");
  await call("focus", { name: "Yami input verification" });
  await call("insertText", {
    text: "Dictation arrived in the original field.",
    target: window.handle,
  });
  for (let i = 0; i < 25 && !output.join("").includes("Dictation arrived"); i++)
    await new Promise((r) => setTimeout(r, 100));
  assert.match(output.join(""), /Dictation arrived in the original field\./);
  const tree = await call("uiaRead");
  assert.ok(tree.some((e) => e.name === "Verification text"));
  console.log(
    "PASS: native focus, clipboard-preserving paste, and Windows accessibility verified against a real text field.",
  );
} finally {
  fixture.kill();
  host.kill();
  reader.close();
}
