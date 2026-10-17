import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
const profile = path.resolve(".artifacts/docs-profile-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(
  path.join(profile, "data.json"),
  JSON.stringify({
    settings: {
      name: "Yami",
      clipboardEnabled: false,
      contextEnabled: false,
      reducedMotion: true,
      weatherEnabled: false,
    },
    todos: [
      { id: "demo", title: "Make room for a calmer workspace", done: false },
    ],
    messages: [],
    memories: [],
  }),
);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
try {
  await app.firstWindow();
  let page;
  for (let i = 0; i < 100; i++) {
    page = app.windows().find((p) => p.url().includes("window=main"));
    if (page) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.waitForSelector(".bottom-dock");
  const target = "Documentation/assets/screenshots";
  fs.mkdirSync(target, { recursive: true });
  // Use a bundled image for the window background only; never change the user's desktop.
  await app
    .evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes("window=main"),
      );
      return w.webContents.executeJavaScript(
        `window.yami.invoke('state').then(s=>s.wallpapers[0])`,
      );
    })
    .then(async (wallpaper) => {
      await page
        .locator(".app-shell")
        .evaluate(
          (element, p) =>
            element.style.setProperty(
              "--wallpaper",
              `url("yami-asset://file/${encodeURIComponent(p)}")`,
            ),
          wallpaper,
        );
    });
  await page.screenshot({ path: `${target}/home.png`, animations: "disabled" });
  await page.getByRole("button", { name: "Soul", exact: true }).click();
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `${target}/loadout.png`,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `${target}/settings.png`,
    animations: "disabled",
  });
  await page.evaluate(() =>
    window.yami.invoke("panel", { open: true, tab: "Controls" }),
  );
  const island = app.windows().find((p) => p.url().includes("window=island"));
  await island.waitForSelector(".utility-shell");
  await island.waitForTimeout(1200);
  await island.screenshot({
    path: `${target}/island.png`,
    animations: "disabled",
  });
  console.log(
    "Captured four real Electron screens using an isolated profile; no keys or personal data.",
  );
} finally {
  await app.close();
}
