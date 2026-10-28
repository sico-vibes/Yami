// Desktop check for Yami Remote's screen view and control, on loopback (no
// firewall prompt). It acts like the paired phone: fetches a screen frame,
// then taps Yami's own chat box, types into it and presses Backspace, so no
// other app receives input. The clipboard is not used. Isolated profile.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/remote-screen-" + Date.now());
skipSetup(profile);
const env = {
  ...process.env,
  YAMI_DATA_DIR: profile,
  YAMI_REMOTE_HOST: "127.0.0.1",
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (m, a) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  await call("modules.set", { id: "remote", enabled: true });
  let info;
  for (let i = 0; i < 50 && !info?.pairing; i++) {
    info = await call("remote.info");
    if (!info.pairing) await wait(100);
  }
  assert.match(info.url, /^http:\/\/127\.0\.0\.1:47822\/$/);
  const token = new URL(info.pairing).hash.replace("#k=", "");
  const api = (p, body) =>
    fetch(info.url.replace(/\/$/, "") + p, {
      method: body ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token },
      body: body && JSON.stringify(body),
    });
  assert.equal((await api("/api/screen")).status, 403, "off by default");
  await call("remote.allow", { name: "screen", allowed: true });
  const shot = await api("/api/screen");
  assert.equal(shot.status, 200);
  const jpeg = Buffer.from(await shot.arrayBuffer());
  assert.equal(jpeg.readUInt16BE(0), 0xffd8, "a JPEG");
  assert.ok(jpeg.length > 5000, `frame of ${jpeg.length} bytes`);
  assert.equal(
    (await api("/api/input", { kind: "type", text: "x" })).status,
    403,
    "viewing alone cannot control",
  );
  await call("remote.allow", { name: "control", allowed: true });
  // Input goes only to Yami's own chat box. Yami's window is kept on top,
  // and before every input Windows itself must report it as the foreground
  // window; otherwise the input part is skipped rather than risk another app.
  const box = main.getByLabel("Message Yami");
  await box.fill("");
  const spot = await app.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows().find((b) =>
      b.webContents.getURL().includes("window=main"),
    );
    w.setAlwaysOnTop(true, "screen-saver");
    w.show();
    w.moveTop();
    w.focus();
    return {
      hwnd: String(w.getNativeWindowHandle().readBigUInt64LE(0)),
      win: w.getContentBounds(),
      display: screen.getPrimaryDisplay().bounds,
    };
  });
  const foreground = () =>
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Add-Type -Name F -Namespace W -MemberDefinition '[DllImport(\"user32.dll\")] public static extern System.IntPtr GetForegroundWindow();'; [W.F]::GetForegroundWindow().ToInt64()",
      ],
      { encoding: "utf8" },
    ).trim();
  await wait(500);
  let inputChecked = "skipped: Yami's window was not in front";
  const safe = () => foreground() === spot.hwnd;
  if (safe()) {
    const rect = await box.boundingBox();
    const x =
      (spot.win.x + rect.x + rect.width / 2 - spot.display.x) /
      spot.display.width;
    const y =
      (spot.win.y + rect.y + rect.height / 2 - spot.display.y) /
      spot.display.height;
    assert.ok(
      x > 0 && x < 1 && y > 0 && y < 1,
      "the box is on the primary screen",
    );
    await box.evaluate((el) => el.blur());
    assert.equal(
      (await api("/api/input", { kind: "click", x, y })).status,
      200,
    );
    await wait(300);
    assert.equal(
      await box.evaluate((el) => document.activeElement === el),
      true,
      "the tap focused the chat box",
    );
    assert.ok(safe(), "still in front before typing");
    assert.equal(
      (await api("/api/input", { kind: "type", text: "hello from phone!" }))
        .status,
      200,
    );
    await wait(300);
    assert.ok(safe(), "still in front before the key");
    assert.equal(
      (await api("/api/input", { kind: "key", key: "backspace" })).status,
      200,
    );
    await wait(300);
    assert.equal(await box.inputValue(), "hello from phone");
    inputChecked = "tap, type and Backspace in Yami's chat box";
  }
  assert.equal(
    (await api("/api/input", { kind: "key", key: "f4" })).status,
    400,
  );
  await box.fill("");
  await app.evaluate(({ BrowserWindow }) => {
    for (const b of BrowserWindow.getAllWindows())
      if (b.webContents.getURL().includes("window=main"))
        b.setAlwaysOnTop(false);
  });
  await call("remote.allow", { name: "control", allowed: false });
  await call("remote.allow", { name: "screen", allowed: false });
  await call("modules.set", { id: "remote", enabled: false });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ passed: true, frameBytes: jpeg.length, inputChecked }),
  );
} finally {
  await app.close();
}
