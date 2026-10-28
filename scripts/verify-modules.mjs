// Desktop check for optional modules: first-run setup on a new profile, no
// setup for an existing one, and lazy load/dispose of the AI workspace.
// Uses isolated profiles under .artifacts; never touches the real profile.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const base = path.resolve(".artifacts/modules-verify-" + Date.now());
const quiet = {
  hotkeys: false,
  roam: false,
  clipboardEnabled: false,
  contextEnabled: false,
  weatherEnabled: false,
};

async function launch(name, data) {
  const profile = path.join(base, name);
  fs.mkdirSync(profile, { recursive: true });
  if (data)
    fs.writeFileSync(path.join(profile, "data.json"), JSON.stringify(data));
  const env = { ...process.env, YAMI_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: [path.resolve(".")], env });
  const errors = [];
  app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(main, "main window");
  return { app, main, errors, profile };
}
const call = (page, method, args) =>
  page.evaluate(
    ([method, args]) =>
      window.yami.invoke(method, args).then(
        (value) => ({ value }),
        (error) => ({ error: String(error.message || error) }),
      ),
    [method, args],
  );
const status = (list, id) => list.find((m) => m.id === id);

// 1. A brand-new profile opens "Choose your Yami", even though nothing ran yet.
{
  const { app, main, errors } = await launch("fresh");
  try {
    await main.getByRole("heading", { name: "Choose your Yami" }).waitFor();
    assert.equal(await main.locator(".bottom-dock").count(), 0);
    const list = (await call(main, "modules.list")).value;
    assert.equal(list.length, 5);
    assert.equal(status(list, "workbench").loaded, false, "workspace asleep");
    await main.getByRole("radio", { name: "Developer" }).click();
    await main.getByRole("button", { name: "Start with Yami" }).click();
    await main.locator(".bottom-dock").waitFor();
    const state = (await call(main, "state")).value;
    assert.equal(state.settings.setupDone, true);
    assert.equal(state.settings.workbenchEnabled, true);
    assert.equal(state.settings.weatherEnabled, false);
    assert.match(
      (await call(main, "setup.complete", { enabled: { nope: true } })).error,
      /Unknown module/,
    );
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
}

// 2. An existing profile skips setup and keeps its data; the workspace wakes
// on first request and is disposed when switched off.
{
  const { app, main, errors, profile } = await launch("existing", {
    settings: quiet,
    messages: [
      { id: "keep", role: "user", text: "Kept", at: new Date().toISOString() },
    ],
  });
  try {
    await main.locator(".bottom-dock").waitFor();
    assert.equal(
      await main.getByRole("heading", { name: "Choose your Yami" }).count(),
      0,
    );
    const state = (await call(main, "state")).value;
    assert.equal(state.settings.setupDone, true);
    assert.ok(state.messages.some((m) => m.text === "Kept"));
    let list = (await call(main, "modules.list")).value;
    assert.equal(status(list, "workbench").loaded, false);
    assert.ok((await call(main, "workbench.state")).value.settings);
    list = (await call(main, "modules.list")).value;
    assert.equal(status(list, "workbench").loaded, true);
    list = (
      await call(main, "modules.set", { id: "workbench", enabled: false })
    ).value;
    assert.equal(status(list, "workbench").enabled, false);
    assert.equal(status(list, "workbench").loaded, false);
    await main
      .locator(".bottom-dock")
      .getByRole("button", { name: "AI", exact: true })
      .waitFor({ state: "detached" });
    assert.match(
      (await call(main, "workbench.state")).error,
      /AI workspace is turned off/,
    );
    assert.match(
      (await call(main, "modules.set", { id: "roam", enabled: "yes" })).error,
      /Choose on or off/,
    );
    await call(main, "modules.set", { id: "fileWheel", enabled: false });
    assert.match(
      (await call(main, "wheel.engines")).error,
      /File wheel is turned off/,
    );
    const saved = JSON.parse(
      fs.readFileSync(path.join(profile, "data.json"), "utf8"),
    );
    assert.equal(saved.settings.workbenchEnabled, false);
    assert.equal(saved.settings.fileWheelEnabled, false);
    assert.ok(saved.messages.some((m) => m.text === "Kept"));
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
}
console.log("Modules verified: first-run setup, migration, lazy workspace.");
