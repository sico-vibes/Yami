// Desktop check for the RustDesk and Windhawk bridges. First against this
// PC as it is (reports what is installed; neither tool is started), then
// against a fake install under the test profile, whose ID, server and mod
// must show in Settings › Phone and on the Tune page. Isolated profiles.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function withApp(extraEnv, fn) {
  const profile = path.resolve(".artifacts/bridges-" + Date.now());
  skipSetup(profile);
  const env = { ...process.env, YAMI_DATA_DIR: profile, ...extraEnv(profile) };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: [path.resolve(".")], env });
  const errors = [];
  app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
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
    const result = await fn(main, call);
    assert.deepEqual(errors, []);
    return result;
  } finally {
    await app.close();
  }
}

const real = await withApp(
  () => ({}),
  async (_main, call) => {
    const rustdesk = await call("bridges.rustdesk");
    const windhawk = await call("bridges.windhawk");
    assert.equal(typeof rustdesk.installed, "boolean");
    assert.equal(windhawk.curated.length, 4);
    if (!rustdesk.installed)
      await assert.rejects(call("bridges.rustdesk.open"), /not installed/);
    if (!windhawk.installed)
      await assert.rejects(call("bridges.windhawk.open"), /not installed/);
    return {
      rustdesk: rustdesk.installed,
      windhawk: windhawk.installed,
      mods: windhawk.mods.length,
    };
  },
);

const fake = await withApp(
  (profile) => {
    const root = path.join(profile, "fake-install");
    const put = (file, text) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    };
    put("Program Files/RustDesk/rustdesk.exe", "");
    put("AppData/RustDesk/config/RustDesk.toml", "id = '246813579'\n");
    put(
      "AppData/RustDesk/config/RustDesk2.toml",
      "[options]\ncustom-rendezvous-server = 'hbbs.home.lan'\n",
    );
    put("Program Files/Windhawk/windhawk.exe", "");
    put(
      "ProgramData/Windhawk/ModsSource/taskbar-clock-customization.wh.cpp",
      "// ==WindhawkMod==\n// @id taskbar-clock-customization\n// @name Taskbar Clock Customization\n// @version 1.5\n",
    );
    return { YAMI_BRIDGE_ROOT: root };
  },
  async (main, call) => {
    await call("show", { tab: "settings" });
    await main.getByRole("button", { name: "Phone" }).first().click();
    await main.getByText("Your ID: 246813579").waitFor();
    await main.getByText(/server hbbs\.home\.lan/).waitFor();
    await assert.rejects(
      call("bridges.rustdesk.open", { config: "--option x" }),
      /Paste the config/,
    );
    await call("modules.set", { id: "tune", enabled: true });
    await main.locator("nav button[aria-label=Tune]").click();
    await main.getByText("Explorer mods (Windhawk)").waitFor();
    await main.getByText("Taskbar Clock Customization").first().waitFor();
    assert.equal(
      await main.getByRole("button", { name: "View mod" }).count(),
      3,
      "the other three curated mods",
    );
    return { shown: true };
  },
);
console.log(JSON.stringify({ passed: true, real, fake }));
