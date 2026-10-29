// Desktop check for the colour picker and always on top. Isolated profile.
// - Picker: a test window filled with a known colour sits under the pointer;
//   the picker overlay is clicked at its centre and must copy that colour.
//   Your clipboard text is put back afterwards.
// - Pin: a throwaway PowerShell window is pinned and unpinned. The check stops
//   unless that test window is the one Yami would pin, so none of your own
//   windows is ever touched.
import { _electron } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/screen-tools-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
let form;
const clipboardBefore = await app
  .evaluate(({ clipboard }) => clipboard.readText())
  .catch(() => "");
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);

  // A 300×300 window in a known colour, centred where the pointer is.
  const spot = await app.evaluate(({ BrowserWindow, screen }) => {
    const p = screen.getCursorScreenPoint();
    const w = new BrowserWindow({
      x: p.x - 150,
      y: p.y - 150,
      width: 300,
      height: 300,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: true,
      backgroundColor: "#12ab34",
    });
    w.loadURL(
      "data:text/html,<body style='margin:0;background:%2312ab34'></body>",
    );
    globalThis.__swatch = w;
    const d = screen.getDisplayNearestPoint(p).bounds;
    return { x: p.x - d.x, y: p.y - d.y };
  });
  await wait(800);
  await call("color.pick");
  let picker;
  for (let i = 0; i < 100 && !picker; i++) {
    picker = app.windows().find((p) => p.url().includes("window=picker"));
    if (!picker) await wait(100);
  }
  assert.ok(picker, "picker window opened");
  await picker.locator(".picker").waitFor();
  await wait(600);
  await picker.mouse.move(spot.x - 4, spot.y - 4);
  await picker.mouse.move(spot.x, spot.y);
  await picker
    .locator(".picker-label")
    .getByText("#12AB34")
    .waitFor({ timeout: 5000 });
  await picker.mouse.click(spot.x, spot.y);
  await wait(500);
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  assert.equal(copied, "#12ab34");
  assert.deepEqual(await call("color.history"), ["#12ab34"]);
  assert.ok(
    !app.windows().some((p) => p.url().includes("window=picker")),
    "overlay closed",
  );
  await app.evaluate(() => globalThis.__swatch.close());

  // Always on top, on a throwaway window only.
  form = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object Windows.Forms.Form; $f.Text = 'Yami pin test'; $f.Width = 320; $f.Height = 200; $f.Add_Shown({ $f.Activate() }); [void]$f.ShowDialog()",
    ],
    { stdio: "ignore" },
  );
  let target;
  for (let i = 0; i < 60; i++) {
    await wait(250);
    target = await call("window.pinned");
    if (/powershell/i.test(target.window)) break;
  }
  assert.match(
    target.window,
    /powershell/i,
    "the test window is the one Yami would pin; nothing else was touched",
  );
  let r = await call("window.pin");
  assert.equal(r.pinned, true);
  assert.equal(r.title, "Yami pin test");
  assert.equal((await call("window.pinned")).pinned, true);
  r = await call("window.pin");
  assert.equal(r.pinned, false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, copied, pinned: r.title }));
} finally {
  form?.kill();
  await app
    .evaluate(
      ({ clipboard }, text) => clipboard.writeText(text),
      clipboardBefore,
    )
    .catch(() => {});
  await app.close();
}
