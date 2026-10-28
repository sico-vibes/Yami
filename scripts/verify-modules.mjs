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

async function launch(name, data, extra = {}) {
  const profile = path.join(base, name);
  fs.mkdirSync(profile, { recursive: true });
  if (data)
    fs.writeFileSync(path.join(profile, "data.json"), JSON.stringify(data));
  const env = { ...process.env, YAMI_DATA_DIR: profile, ...extra };
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
    assert.equal(list.length, 8);
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
  const { app, main, errors, profile } = await launch(
    "existing",
    {
      settings: quiet,
      messages: [
        {
          id: "keep",
          role: "user",
          text: "Kept",
          at: new Date().toISOString(),
        },
      ],
    },
    { YAMI_MAIN_RELEASE_MS: "1500" },
  );
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
    assert.match(
      (await call(main, "packs.install", { id: "not-a-pack" })).error,
      /Unknown download/,
    );
    // Whistle dictation refuses while its module is off; nothing is run.
    await call(main, "settings", { dictationEngine: "whistle" });
    const silence = Buffer.alloc(44 + 3200);
    silence.write("RIFF", 0, "ascii");
    silence.write("WAVE", 8, "ascii");
    assert.match(
      (
        await call(main, "dictation", {
          data: silence.toString("base64"),
          mimeType: "audio/wav",
        })
      ).error,
      /Offline dictation is turned off/,
    );
    await call(main, "settings", { dictationEngine: "gemini" });
    // Opt-in: downloads the pinned 7-Zip console (about 0.6 MB) into this
    // isolated profile, then removes it.
    if (process.argv.includes("--download")) {
      await call(main, "modules.set", { id: "fileWheel", enabled: true });
      const pack = async () =>
        status(
          (await call(main, "modules.list")).value,
          "fileWheel",
        ).packs.find((p) => p.id === "sevenZip");
      assert.equal((await pack()).state, "missing");
      await call(main, "packs.install", { id: "sevenZip" });
      for (let i = 0; i < 600 && (await pack()).state !== "installed"; i++) {
        assert.notEqual((await pack()).state, "failed", (await pack()).error);
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.equal((await pack()).state, "installed");
      assert.ok(fs.existsSync(path.join(profile, "engines", "sevenZip")));
      await call(main, "packs.remove", { id: "sevenZip" });
      assert.equal((await pack()).state, "missing");
      await call(main, "modules.set", { id: "fileWheel", enabled: false });
    }
    const saved = JSON.parse(
      fs.readFileSync(path.join(profile, "data.json"), "utf8"),
    );
    assert.equal(saved.settings.workbenchEnabled, false);
    assert.equal(saved.settings.fileWheelEnabled, false);
    assert.ok(saved.messages.some((m) => m.text === "Kept"));
    // A hidden main window releases its renderer, then comes back on the
    // page it was asked for, through the queued navigate event.
    const island = app.windows().find((p) => p.url().includes("window=island"));
    await call(main, "hide");
    for (let i = 0; i < 100 && app.windows().includes(main); i++)
      await new Promise((r) => setTimeout(r, 100));
    assert.equal(app.windows().includes(main), false, "main window released");
    await call(island, "show", { tab: "settings" });
    let again;
    for (let i = 0; i < 100 && !again; i++) {
      again = app.windows().find((p) => p.url().includes("window=main"));
      if (!again) await new Promise((r) => setTimeout(r, 100));
    }
    await again.locator(".settings-sidebar").waitFor({ timeout: 15000 });
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
}
console.log("Modules verified: first-run setup, migration, lazy workspace.");
