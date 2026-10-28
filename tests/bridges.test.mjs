import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createBridges,
  modHeader,
  readToml,
  validRustdeskConfig,
} from "../electron/bridges.ts";

test("RustDesk and Windhawk files are read without running either", () => {
  const toml = readToml(
    "rendezvous_server = 'rs-ny.rustdesk.com:21116'\nid = \"123456789\"\n\n[options]\ncustom-rendezvous-server = 'hbbs.example.com'\nrelay-server = 'hbbr.example.com'\nkey = 'AbC='\n",
  );
  assert.equal(toml[""].id, "123456789");
  assert.equal(toml.options["custom-rendezvous-server"], "hbbs.example.com");
  assert.equal(toml.options.key, "AbC=");
  assert.deepEqual(
    modHeader(
      "// ==WindhawkMod==\n// @id              taskbar-clock-customization\n// @name            Taskbar Clock Customization\n// @version         1.5\n// ==/WindhawkMod==",
    ),
    {
      id: "taskbar-clock-customization",
      name: "Taskbar Clock Customization",
      version: "1.5",
    },
  );
  assert.ok(
    validRustdeskConfig("9JSPSlUQ2UzMh9VTJdmZyVHMkJ1Rv0lZLdVOXVWdyQkTsNmb"),
  );
  assert.ok(!validRustdeskConfig("abc"), "too short");
  assert.ok(!validRustdeskConfig("--option-relay-server-x"), "not a flag");
  assert.ok(
    !validRustdeskConfig("x".repeat(20) + " --option evil"),
    "no spaces or flags",
  );
});

test("bridges report not installed, then a fake install's ID, server and mods", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-bridges-"));
  const bridges = createBridges({ YAMI_BRIDGE_ROOT: root });
  assert.deepEqual(await bridges.rustdesk(), {
    installed: false,
    id: "",
    idServer: "",
    relayServer: "",
    hasKey: false,
  });
  assert.equal((await bridges.windhawk()).installed, false);
  await assert.rejects(bridges.openRustdesk(), /not installed/);
  await assert.rejects(bridges.openWindhawk(), /not installed/);
  const put = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  put("Program Files/RustDesk/rustdesk.exe", "");
  put("AppData/RustDesk/config/RustDesk.toml", "id = '987654321'\n");
  put(
    "AppData/RustDesk/config/RustDesk2.toml",
    "[options]\ncustom-rendezvous-server = 'hbbs.home.lan'\nkey = 'k='\n",
  );
  put("Program Files/Windhawk/windhawk.exe", "");
  put(
    "ProgramData/Windhawk/ModsSource/taskbar-clock-customization.wh.cpp",
    "// ==WindhawkMod==\n// @id taskbar-clock-customization\n// @name Taskbar Clock Customization\n// @version 1.5\n",
  );
  assert.deepEqual(await bridges.rustdesk(), {
    installed: true,
    id: "987654321",
    idServer: "hbbs.home.lan",
    relayServer: "",
    hasKey: true,
  });
  await assert.rejects(
    bridges.openRustdesk("not a config"),
    /Paste the config/,
  );
  const hawk = await bridges.windhawk();
  assert.equal(hawk.installed, true);
  assert.deepEqual(hawk.mods, [
    {
      id: "taskbar-clock-customization",
      name: "Taskbar Clock Customization",
      version: "1.5",
      disabled: undefined,
    },
  ]);
  assert.ok(hawk.curated.some((m) => m.id === "windows-11-taskbar-styler"));
  fs.rmSync(root, { recursive: true, force: true });
});
