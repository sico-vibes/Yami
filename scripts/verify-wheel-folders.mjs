// Desktop check for folders on the file wheel: drops a temporary folder on
// the shelf, flips to actions, then zips it, measures it and adds it as a
// project. Everything happens inside an isolated profile under .artifacts.
import { _electron } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/wheel-folders-" + Date.now());
skipSetup(profile);
const site = path.join(profile, "work", "site");
fs.mkdirSync(path.join(site, "css"), { recursive: true });
fs.writeFileSync(path.join(site, "index.html"), "<h1>demo</h1>");
fs.writeFileSync(path.join(site, "css", "a.css"), "h1{}");
const icon = path.join(profile, "work", "star.ico");
fs.writeFileSync(icon, "icon");
const env = { ...process.env, YAMI_DATA_DIR: profile, YAMI_TEST_ICON: icon };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await new Promise((r) => setTimeout(r, 100));
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  const toasts = [];
  await main.exposeFunction("__toast", (m) => toasts.push(m));
  await main.evaluate(() =>
    window.yami.on((e) => e.type === "toast" && window.__toast(e.message)),
  );
  const open = async () => {
    await call("wheel.shelf.drop", { paths: [site] });
    const session = await call("wheel.session");
    assert.equal(session.files[0].folder, true);
    await call("wheel.swap", { mode: "actions" });
  };
  await open();
  await assert.rejects(
    call("wheel.choose", { petalId: "action:float" }),
    /does not fit/,
  );
  await open();
  await call("wheel.choose", { petalId: "action:zip" });
  const zip = path.join(profile, "work", "site.zip");
  assert.ok(fs.existsSync(zip), "zip written beside the folder");
  assert.ok(fs.statSync(zip).size > 100);
  await open();
  await call("wheel.choose", { petalId: "action:size" });
  await open();
  await call("wheel.choose", { petalId: "action:duplicates" });
  await open();
  await call("wheel.choose", { petalId: "action:project" });
  for (let i = 0; i < 50 && toasts.length < 4; i++)
    await new Promise((r) => setTimeout(r, 100));
  assert.ok(
    toasts.some((t) => /^Zipped to site\.zip/.test(t)),
    toasts.join(" | "),
  );
  assert.ok(
    toasts.some((t) => /site: .* in 2 files/.test(t)),
    toasts.join(" | "),
  );
  assert.ok(
    toasts.some((t) => /No duplicate files in site/.test(t)),
    toasts.join(" | "),
  );
  assert.ok(
    toasts.some((t) => /Added site to Projects/.test(t)),
    toasts.join(" | "),
  );
  // Copy text from an image with Windows OCR; the clipboard is restored.
  const image = path.join(profile, "work", "sign.png");
  execFileSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap 900,140; $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::White); $g.DrawString('Yami copies this text', (New-Object System.Drawing.Font 'Segoe UI',40), [System.Drawing.Brushes]::Black, 20, 30); $g.Dispose(); $b.Save('${image.replace(/'/g, "''")}'); $b.Dispose()`,
  ]);
  const saved = await app.evaluate(({ clipboard }) => clipboard.readText());
  try {
    await call("wheel.shelf.drop", { paths: [image] });
    await call("wheel.swap", { mode: "tools" });
    await call("wheel.choose", { petalId: "tool:ocr" });
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
    assert.equal(copied, "Yami copies this text");
  } finally {
    await app.evaluate(
      ({ clipboard }, text) => clipboard.writeText(text),
      saved,
    );
  }
  // A watch folder converts a new Markdown file to HTML once, by itself.
  const inbox = path.join(profile, "work", "inbox");
  fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, "old.md"), "# Already here\n");
  const watches = await call("watch.add", { target: "to:html", folder: inbox });
  assert.equal(watches.length, 1);
  fs.writeFileSync(path.join(inbox, "notes.md"), "# Watched\n\nHello.\n");
  let produced = [];
  for (let i = 0; i < 60 && !produced.length; i++) {
    await new Promise((r) => setTimeout(r, 200));
    produced = fs.readdirSync(inbox).filter((f) => /^notes.*\.html$/.test(f));
  }
  assert.equal(produced.length, 1, fs.readdirSync(inbox).join(", "));
  assert.match(
    fs.readFileSync(path.join(inbox, produced[0]), "utf8"),
    /Watched/,
  );
  await new Promise((r) => setTimeout(r, 2500));
  assert.ok(
    !fs.readdirSync(inbox).some((f) => /^old.*\.html$/.test(f)),
    "files already there are left alone",
  );
  assert.equal(
    fs.readdirSync(inbox).filter((f) => f.endsWith(".html")).length,
    1,
    "converted once",
  );
  await call("watch.remove", { id: watches[0].id });
  assert.deepEqual(await call("watch.list"), []);
  // Batch rename through the tool window.
  const shots = path.join(profile, "work", "shots");
  fs.mkdirSync(shots, { recursive: true });
  fs.writeFileSync(path.join(shots, "IMG_9.txt"), "a");
  fs.writeFileSync(path.join(shots, "IMG_3.txt"), "b");
  await call("wheel.shelf.drop", {
    paths: [path.join(shots, "IMG_9.txt"), path.join(shots, "IMG_3.txt")],
  });
  await call("wheel.swap", { mode: "tools" });
  assert.deepEqual(await call("wheel.choose", { petalId: "tool:rename" }), {
    tool: "tool:rename",
  });
  let toolWindow;
  for (let i = 0; i < 100 && !toolWindow; i++) {
    toolWindow = app.windows().find((p) => p.url().includes("window=tool"));
    if (!toolWindow) await new Promise((r) => setTimeout(r, 100));
  }
  await toolWindow.getByLabel("Name pattern").fill("trip-{n}");
  await toolWindow.getByRole("button", { name: "Rename 2 files" }).click();
  for (
    let i = 0;
    i < 40 && !fs.existsSync(path.join(shots, "trip-02.txt"));
    i++
  )
    await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(fs.readdirSync(shots).sort(), [
    "trip-01.txt",
    "trip-02.txt",
  ]);
  assert.equal(fs.readFileSync(path.join(shots, "trip-01.txt"), "utf8"), "a");
  // Folder icon: set, then reset, on the temporary folder only.
  await open();
  await call("wheel.choose", { petalId: "action:icon" });
  const ini = path.join(site, "desktop.ini");
  for (let i = 0; i < 40 && !fs.existsSync(ini); i++)
    await new Promise((r) => setTimeout(r, 100));
  assert.match(fs.readFileSync(ini, "utf8"), /IconResource=.*star\.ico,0/);
  const flags = () =>
    execFileSync("attrib.exe", [site], { encoding: "utf8" }).slice(0, 12);
  assert.match(flags(), /R/, "the folder is marked to read desktop.ini");
  await open();
  await call("wheel.choose", { petalId: "action:icon-reset" });
  for (let i = 0; i < 40 && fs.existsSync(ini); i++)
    await new Promise((r) => setTimeout(r, 100));
  assert.ok(!fs.existsSync(ini), "icon reset");
  assert.doesNotMatch(flags(), /R/);
  const projects = (await call("workbench.state")).projects;
  assert.equal(projects[0].path, site);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, toasts }));
} finally {
  await app.close();
}
