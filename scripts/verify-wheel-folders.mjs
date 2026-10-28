// Desktop check for folders on the file wheel: drops a temporary folder on
// the shelf, flips to actions, then zips it, measures it and adds it as a
// project. Everything happens inside an isolated profile under .artifacts.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/wheel-folders-" + Date.now());
skipSetup(profile);
const site = path.join(profile, "work", "site");
fs.mkdirSync(path.join(site, "css"), { recursive: true });
fs.writeFileSync(path.join(site, "index.html"), "<h1>demo</h1>");
fs.writeFileSync(path.join(site, "css", "a.css"), "h1{}");
const env = { ...process.env, YAMI_DATA_DIR: profile };
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
  await call("wheel.choose", { petalId: "action:project" });
  for (let i = 0; i < 50 && toasts.length < 3; i++)
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
    toasts.some((t) => /Added site to Projects/.test(t)),
    toasts.join(" | "),
  );
  const projects = (await call("workbench.state")).projects;
  assert.equal(projects[0].path, site);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, toasts }));
} finally {
  await app.close();
}
