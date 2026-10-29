// LIVE check, run only with the owner's approval: switches Windows to the
// other light/dark mode and back, then applies Tune's "Yami's violet as the
// Windows accent" and undoes it. The exact earlier values are saved first
// and written back at the end. Screenshots of the main screen are saved in
// the profile for a person to look at. Isolated profile.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/theme-live-" + Date.now());
skipSetup(profile);
const personalize =
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";
const accentKeys = [
  [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent",
    "AccentPalette",
  ],
  [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent",
    "AccentColorMenu",
  ],
  [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent",
    "StartColorMenu",
  ],
  ["HKCU\\Software\\Microsoft\\Windows\\DWM", "AccentColor"],
  ["HKCU\\Software\\Microsoft\\Windows\\DWM", "ColorizationColor"],
];
const read = (key, name) => {
  try {
    const out = execFileSync("reg.exe", ["query", key, "/v", name], {
      encoding: "utf8",
    });
    return (
      /REG_\w+\s+(\S+)/.exec(
        out.split(/\r?\n/).find((l) => l.includes(name)) || "",
      )?.[1] || ""
    );
  } catch {
    return "(not set)";
  }
};
const appsLight = read(personalize, "AppsUseLightTheme");
const systemLight = read(personalize, "SystemUsesLightTheme");
const accentBefore = accentKeys.map(([k, n]) => read(k, n));
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  const png = await app.evaluate(async ({ desktopCapturer }) => {
    const [s] = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1280, height: 720 },
    });
    return s.thumbnail.toPNG().toString("base64");
  });
  fs.writeFileSync(
    path.join(profile, name + ".png"),
    Buffer.from(png, "base64"),
  );
};
const result = {};
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
  const wasDark = appsLight === "0x0";
  await call("control", { method: "theme", args: { dark: !wasDark } });
  await wait(6000);
  result.switched =
    read(personalize, "AppsUseLightTheme") === (wasDark ? "0x1" : "0x0");
  await shot("theme-switched");
  await call("control", { method: "theme", args: { dark: wasDark } });
  await wait(1500);
  await call("modules.set", { id: "tune", enabled: true });
  await call("tune.apply", { ids: ["yamiAccent"] });
  // Ask Windows to pick up the new colours, as the Settings app does.
  await call("control", { method: "theme", args: { dark: wasDark } });
  await wait(2500);
  result.accentApplied =
    read(accentKeys[1][0], accentKeys[1][1]) === "0xfff06f8b";
  await shot("accent-applied");
  await call("tune.undo", { ids: ["yamiAccent"] });
  await call("control", { method: "theme", args: { dark: wasDark } });
  await wait(1500);
} finally {
  await app.close();
  // Put back the exact light/dark values, whatever happened above.
  for (const [name, value] of [
    ["AppsUseLightTheme", appsLight],
    ["SystemUsesLightTheme", systemLight],
  ])
    if (value.startsWith("0x"))
      execFileSync("reg.exe", [
        "add",
        personalize,
        "/v",
        name,
        "/t",
        "REG_DWORD",
        "/d",
        String(parseInt(value, 16)),
        "/f",
      ]);
}
result.themeRestored =
  read(personalize, "AppsUseLightTheme") === appsLight &&
  read(personalize, "SystemUsesLightTheme") === systemLight;
result.accentRestored = accentKeys.every(
  ([k, n], i) => read(k, n) === accentBefore[i],
);
assert.equal(result.switched, true, "the theme switched");
assert.equal(result.accentApplied, true, "the accent was applied");
assert.equal(result.themeRestored, true, "light/dark values are back");
assert.equal(
  result.accentRestored,
  true,
  JSON.stringify({
    before: accentBefore,
    after: accentKeys.map(([k, n]) => read(k, n)),
  }),
);
console.log(JSON.stringify({ passed: true, result, screenshots: profile }));
