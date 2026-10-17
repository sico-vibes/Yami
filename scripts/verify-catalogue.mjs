import { _electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const env = {
  ...process.env,
  YAMI_DATA_DIR: path.resolve(".artifacts/catalogue-" + Date.now()),
};
delete env.ELECTRON_RUN_AS_NODE;
fs.mkdirSync(env.YAMI_DATA_DIR, { recursive: true });
fs.writeFileSync(
  path.join(env.YAMI_DATA_DIR, "data.json"),
  JSON.stringify({
    settings: { clipboardEnabled: false },
    owned: ["hitodama", "Charon", "chad", "Puck"],
  }),
);
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
  await page.evaluate(() =>
    window.yami.invoke("settings", {
      clipboardEnabled: false,
      reducedMotion: true,
    }),
  );
  const call = (method, args) =>
    page.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  const node = async (index) => {
    let r = await page.locator(".loadout-node").nth(index).boundingBox();
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  };
  fs.mkdirSync(".impeccable/review/catalogue-corrections", { recursive: true });
  await page.getByRole("button", { name: "Soul", exact: true }).click();
  await node(0);
  await page.getByRole("button", { name: "Next card" }).click();
  const front = page.locator(".loadout-card[data-front=true]");
  assert.equal(await front.locator("h3").innerText(), "New");
  assert.match(await front.locator("button").innerText(), /100 embers/);
  assert.equal(await front.locator("button").isDisabled(), true);
  assert.equal(await page.locator(".personality-input").count(), 0);
  await assert.rejects(
    call("loadout.equip", { id: "custom" }),
    /100 more embers/,
  );
  await page.screenshot({
    path: ".impeccable/review/catalogue-corrections/personality-new.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close catalogue" }).click();
  await node(1);
  assert.match(await front.locator("p").innerText(), /OG voice/);
  await page.getByRole("button", { name: "Next card" }).click();
  assert.equal(await front.locator("h3").innerText(), "Puck");
  assert.equal(await front.locator("p").innerText(), "");
  assert.equal(await front.locator(".ph-lock-simple").count(), 0);
  await page.screenshot({
    path: ".impeccable/review/catalogue-corrections/voice-owned.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Next card" }).click();
  assert.equal(await front.locator("h3").innerText(), "Leda");
  assert.equal(await front.locator("p").innerText(), "");
  assert.equal(await front.locator(".ph-lock-simple").count(), 1);
  await page.screenshot({
    path: ".impeccable/review/catalogue-corrections/voice-locked.png",
    animations: "disabled",
  });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().includes("window=main"))
      .setContentSize(850, 610),
  );
  await page.screenshot({
    path: ".impeccable/review/catalogue-corrections/voice-locked-small.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close catalogue" }).click();
  await node(0);
  await page.getByRole("button", { name: "Next card" }).click();
  await page.screenshot({
    path: ".impeccable/review/catalogue-corrections/personality-new-small.png",
    animations: "disabled",
  });
  const result = {
    passed: true,
    checks: [
      "reference personality title",
      "100-ember price",
      "backend price enforcement",
      "locked editor hidden",
      "free voice description retained",
      "locked voice description hidden",
      "locked voice padlock",
      "owned paid voice description hidden",
      "owned paid voice unlocked artwork",
    ],
    viewports: [
      [1160, 790],
      [850, 610],
    ],
  };
  fs.writeFileSync(
    ".artifacts/catalogue-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await app.close();
}
