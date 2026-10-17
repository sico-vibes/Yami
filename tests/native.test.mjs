import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import readline from "node:readline";
import path from "node:path";
test(
  "compiled Windows host reads real state and protects unknown operations",
  { skip: process.platform !== "win32", timeout: 30000 },
  async () => {
    const child = spawn(path.resolve("native/bin/Yami.Native.exe"), [], {
      windowsHide: true,
    });
    const pending = new Map();
    let sequence = 0;
    const reader = readline.createInterface({ input: child.stdout });
    reader.on("line", (line) => {
      const result = JSON.parse(line);
      const p = pending.get(result.id);
      if (p) {
        pending.delete(result.id);
        result.error
          ? p.reject(new Error(result.error))
          : p.resolve(result.result);
      }
    });
    const call = (method, args = {}) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        child.stdin.write(JSON.stringify({ id, method, args }) + "\n");
      });
    try {
      assert.equal((await call("ping")).ok, true);
      const controls = await call("controls");
      assert.ok(controls.volume >= 0 && controls.volume <= 100);
      assert.equal(typeof controls.dark, "boolean");
      const windows = await call("windows");
      assert.ok(Array.isArray(windows));
      const screenshot = await call("capture", {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      assert.equal(screenshot.width, 100);
      assert.equal(
        Buffer.from(screenshot.data, "base64").subarray(0, 2).toString("hex"),
        "ffd8",
      );
      await call("clipboardPreserve");
      try {
        await call("clipboardWrite", { text: "Yami native verification" });
        assert.equal(await call("clipboardRead"), "Yami native verification");
      } finally {
        await call("clipboardRestore");
      }
      await call("volume", { value: controls.volume });
      assert.ok(
        Math.abs((await call("controls")).volume - controls.volume) <= 1,
      );
      await call("configure", {
        hotkeys: false,
        voiceShortcut: "Ctrl+Alt+Y",
        dictationShortcut: "Ctrl+Win",
        circleShortcut: "Ctrl+Shift",
      });
      await assert.rejects(call("not-a-method"), /Unknown native method/);
      await assert.rejects(
        call("settings", { page: "arbitrary" }),
        /Unknown settings page/,
      );
    } finally {
      reader.close();
      child.kill();
    }
  },
);
