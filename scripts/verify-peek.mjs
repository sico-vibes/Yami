// Desktop check for quick look. Opens previews of test files through the same
// code Ctrl+Space in File Explorer uses (the peek.open request), and checks:
// an HTML file is shown as text and its script does not run; an SVG with a
// script shows but the script does not run; a second open of a preview
// closes it; unknown kinds are refused. No Explorer window is touched.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/peek-verify-" + Date.now());
skipSetup(profile);
const dir = path.join(profile, "files");
fs.mkdirSync(dir, { recursive: true });
const html = path.join(dir, "page.html");
fs.writeFileSync(html, "<h1>Hi</h1><script>document.title='RAN'</script>");
const svg = path.join(dir, "art.svg");
fs.writeFileSync(
  svg,
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" onload="document.title=\'RAN\'"><rect width="40" height="40" fill="red"/></svg>',
);
const exe = path.join(dir, "tool.exe");
fs.writeFileSync(exe, "MZ");
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
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
  const preview = async () => {
    for (let i = 0; i < 50; i++) {
      const w = app
        .windows()
        .find(
          (p) =>
            p.url().startsWith("data:text/html") ||
            p.url().includes("peek-verify"),
        );
      if (w) return w;
      await wait(100);
    }
    throw new Error("No preview window opened.");
  };
  assert.equal(await call("peek.open", { path: html }), "text");
  let w = await preview();
  await wait(400);
  assert.match(
    await w.locator("pre").textContent(),
    /<script>document\.title='RAN'<\/script>/,
  );
  assert.notEqual(await w.title(), "RAN", "the HTML file's script did not run");
  assert.equal(
    await call("peek.open", { path: html }),
    "closed",
    "opening again closes",
  );
  await wait(400);
  assert.equal(await call("peek.open", { path: svg }), "image");
  w = await preview();
  await wait(600);
  assert.notEqual(await w.title(), "RAN", "the SVG's script did not run");
  await call("peek.open", { path: svg });
  assert.equal(await call("peek.open", { path: exe }), "no preview");
  assert.equal(await call("peek.open", { path: dir }), "not a file");
  console.log(JSON.stringify({ passed: true }));
} finally {
  await app.close();
}
