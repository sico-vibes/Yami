import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
const env = {
  ...process.env,
  YAMI_DATA_DIR: path.resolve(".artifacts/inspection-data"),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [path.resolve(".")], env });
const errors = [];
await app.firstWindow();
for (const p of app.windows()) {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
}
let page;
for (let i = 0; i < 100; i++) {
  page = app.windows().find((p) => p.url().includes("window=main"));
  if (page) break;
  await new Promise((r) => setTimeout(r, 100));
}
try {
  await page.waitForSelector(".bottom-dock");
} catch (e) {
  console.log(
    JSON.stringify(
      {
        windows: app.windows().map((p) => p.url()),
        errors,
        html: await page.content(),
      },
      null,
      2,
    ),
  );
  await app.close();
  throw e;
}
await page.evaluate(() => document.fonts.ready);
async function clickNode(index) {
  const r = await page.locator(".loadout-node").nth(index).boundingBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}
fs.mkdirSync(".impeccable/review", { recursive: true });
const invoke = (method, args) =>
  page.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
await invoke("settings", { clipboardEnabled: false, reducedMotion: true });
const result = {
  diagnostics: await invoke("diagnostics"),
  apps: (await invoke("apps")).length,
  controls: await invoke("controls"),
  state: await invoke("state"),
};
await page.screenshot({
  path: ".impeccable/review/home.png",
  animations: "disabled",
});
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.waitForSelector(".settings-content");
await page.screenshot({
  path: ".impeccable/review/settings.png",
  animations: "disabled",
});
for (const title of [
  "Yami",
  "Shortcuts",
  "Behavior",
  "System",
  "Your data",
  "Privacy",
]) {
  await page
    .locator(".settings-sidebar")
    .getByRole("button", { name: title, exact: true })
    .click();
  await page.screenshot({
    path:
      ".impeccable/review/settings-" +
      title.toLowerCase().replaceAll(" ", "-") +
      ".png",
    animations: "disabled",
  });
}
await page.getByRole("button", { name: "Bond", exact: true }).click();
await page.screenshot({
  path: ".impeccable/review/bond.png",
  animations: "disabled",
});
await page.getByRole("button", { name: "Desk", exact: true }).click();
await page.screenshot({
  path: ".impeccable/review/desk.png",
  animations: "disabled",
});
await page.getByRole("button", { name: "Soul", exact: true }).click();
await page.waitForSelector(".loadout-hub");
await page.screenshot({
  path: ".impeccable/review/loadout.png",
  animations: "disabled",
});
await page
  .getByRole("button", { name: "Voice Charon", exact: false })
  .count()
  .catch(() => 0);
await clickNode(1);
await page.waitForSelector(".card-deck");
await page.screenshot({
  path: ".impeccable/review/voice.png",
  animations: "disabled",
});
await page.getByRole("button", { name: "Next card" }).click();
await page.getByRole("button", { name: "Next card" }).click();
await page.screenshot({
  path: ".impeccable/review/voice-locked.png",
  animations: "disabled",
});
await page.getByRole("button", { name: "Close catalogue" }).click();
for (const [slot, title] of [
  [0, "personality"],
  [2, "soul"],
  [3, "abilities"],
]) {
  await clickNode(slot);
  await page.screenshot({
    path: ".impeccable/review/catalogue-" + title + ".png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close catalogue" }).click();
}
await app.evaluate(({ BrowserWindow }) => {
  BrowserWindow.getAllWindows()
    .find((w) => w.webContents.getURL().includes("window=main"))
    .setContentSize(850, 610);
});
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.screenshot({
  path: ".impeccable/review/settings-small.png",
  animations: "disabled",
});
await app.evaluate(({ BrowserWindow }) => {
  BrowserWindow.getAllWindows()
    .find((w) => w.webContents.getURL().includes("window=main"))
    .setContentSize(1160, 790);
});
await invoke("panel", { open: true, tab: "Wallpaper" });
const island = app.windows().find((p) => p.url().includes("window=island"));
await island.waitForSelector(".wallpaper-fan img");
await island.screenshot({
  path: ".impeccable/review/wallpaper.png",
  animations: "disabled",
});
for (const tab of [
  "Controls",
  "Today",
  "Stats",
  "Clipboard",
  "Apps",
  "Power",
]) {
  await invoke("panel", { open: true, tab });
  await island.locator(".utility-" + tab.toLowerCase()).waitFor();
  if (tab === "Stats") await island.locator(".stat-gauge").first().waitFor();
  if (tab === "Controls")
    await island.waitForFunction(
      () => document.querySelector(".volume-slider b")?.textContent !== "—",
    );
  await island.screenshot({
    path: ".impeccable/review/utility-" + tab.toLowerCase() + ".png",
    animations: "disabled",
  });
}
result.metrics = await invoke("metrics");
result.errors = errors;
fs.writeFileSync(".artifacts/inspection.json", JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      apps: result.apps,
      controls: result.controls,
      diagnostics: result.diagnostics,
      errors,
    },
    null,
    2,
  ),
);
await app.close();
