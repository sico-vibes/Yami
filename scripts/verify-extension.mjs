// Check of the Yami Home extension in a throwaway Microsoft Edge profile
// (never your own): Yami's link is started here on its real port, the
// prepared extension is loaded with that key, the new tab is shown, and the
// extension's background hands a link to the link, which must receive it.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { BrowserLink } from "../electron/downloads/link.ts";

const out = process.argv[2] || os.tmpdir();
const data = fs.mkdtempSync(path.join(os.tmpdir(), "yami-ext-data-"));
const added = [];
const link = new BrowserLink(data, path.resolve("extension"), (url, name) =>
  added.push(url),
);
await link.set(true);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "yami-edge-ext-"));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: "msedge",
  headless: false,
  args: [
    `--disable-extensions-except=${link.folder()}`,
    `--load-extension=${link.folder()}`,
    "--window-position=-2400,-2400",
  ],
});
try {
  const sw =
    ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  const id = sw.url().split("/")[2];
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/newtab.html`);
  await page.locator(".tile").first().waitFor();
  assert.equal(
    await page.locator("#panel").isVisible(),
    false,
    "Customize starts closed",
  );
  await page.getByLabel("Customize").click();
  await page.getByText("Linked to Yami").waitFor({ timeout: 8000 });
  await page.screenshot({ path: path.join(out, "yami-home-panel.png") });
  await page.getByRole("button", { name: "Done" }).click();
  await page.screenshot({ path: path.join(out, "yami-home.png") });
  // The context-menu action, run in the extension's background.
  await sw.evaluate(() => send("https://example.com/from-extension.zip"));
  for (let i = 0; i < 40 && !added.length; i++)
    await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(added, ["https://example.com/from-extension.zip"]);
  console.log(JSON.stringify({ passed: true, id }));
} finally {
  await ctx.close();
  await link.close();
  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(data, { recursive: true, force: true });
}
