import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const origin = `http://127.0.0.1:${Number(process.env.YAMI_PREVIEW_PORT) || 5174}/`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1460, height: 1040 },
  deviceScaleFactor: 1,
});
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith(origin))
    external.push(r.url());
});
const target = "docs/internal/assets/screenshots";
fs.mkdirSync(target, { recursive: true });
try {
  await page.goto(origin);
  await page.frameLocator("#preview-frame").locator(".bottom-dock").waitFor();
  const selector = page.getByLabel("Preview screen");
  for (const screen of [
    "Home",
    "Bond",
    "Soul",
    "Desk",
    "Settings",
    "AI",
    "Terminal",
    "Island",
    "Controls",
    "Today",
    "Stats",
    "Clipboard",
    "Apps",
    "Wallpaper",
    "Power",
    "Stray",
    "Caption",
  ]) {
    await selector.selectOption(screen);
    await page.frameLocator("#preview-frame").locator("#root > *").waitFor();
    await page.waitForTimeout(250);
    await page.locator(".preview-stage").waitFor({ state: "visible" });
    if (screen === "Stats")
      await page
        .frameLocator("#preview-frame")
        .getByRole("button", { name: "Run speed test" })
        .click();
    if (screen === "Stray")
      assert.ok(
        await page
          .frameLocator("#preview-frame")
          .locator(".stray-cat")
          .isVisible(),
      );
    if (screen === "Caption")
      await page
        .frameLocator("#preview-frame")
        .locator(".caption-pill")
        .waitFor({ timeout: 3000 });
    if (screen === "Wallpaper")
      assert.equal(
        await page
          .frameLocator("#preview-frame")
          .locator(".wallpaper-fan button")
          .count(),
        10,
      );
  }
  await selector.selectOption("AI");
  const frame = page.frameLocator("#preview-frame");
  for (const section of [
    "Sessions",
    "Usage",
    "Connections",
    "Context",
    "Dictation",
    "Notes",
    "Recap",
    "MCP",
    "Workspace",
  ]) {
    await frame
      .getByRole("navigation", { name: "AI sections" })
      .getByRole("button", { name: section, exact: true })
      .click();
    await frame.locator(".settings-content h1").waitFor();
    assert.equal(
      await frame.locator(".settings-content h1").count(),
      1,
      section,
    );
    assert.equal(
      await page
        .locator("#preview-frame")
        .evaluate(
          (f) =>
            f.contentDocument.documentElement.scrollWidth <=
            f.contentWindow.innerWidth,
        ),
      true,
      section + " must fit",
    );
  }
  await assert.rejects(
    page.locator("#preview-frame").evaluate((f) =>
      f.contentWindow.yami.invoke("workbench.settings", {
        usageKey: "fixture",
      }),
    ),
    /never stores credentials/,
  );
  await selector.selectOption("Home");
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${target}/preview.png` });
  await selector.selectOption("Desk");
  await page.waitForTimeout(150);
  const todos = await page
    .locator("#preview-frame")
    .evaluate((f) => f.contentWindow.yami.invoke("state"));
  await page
    .locator("#preview-frame")
    .evaluate((f) =>
      f.contentWindow.yami.invoke("todo.add", { title: "Preview test" }),
    );
  assert.equal(
    (
      await page
        .locator("#preview-frame")
        .evaluate((f) => f.contentWindow.yami.invoke("state"))
    ).todos.length,
    todos.todos.length + 1,
  );
  await assert.rejects(
    page.locator("#preview-frame").evaluate((f) =>
      f.contentWindow.yami.invoke("keys.save", {
        provider: "gemini",
        key: "DEMO",
      }),
    ),
    /never stores credentials/,
  );
  assert.equal(
    external.length,
    0,
    "Preview must not make provider or public network requests",
  );
  await page.goto(pathToFileURL(path.resolve("docs/internal/index.html")).href);
  await page.waitForSelector("article h1");
  const links = await page.locator(".nav-item").count();
  assert.ok(links >= 10);
  for (let i = 0; i < links; i++) {
    await page.locator(".nav-item").nth(i).click();
    await page.waitForSelector("article h1");
    assert.ok((await page.locator("article").innerText()).length > 100);
  }
  await page.keyboard.press("Control+k");
  await page.getByRole("searchbox").fill("tool");
  assert.ok((await page.locator(".search-result").count()) > 0);
  await page.keyboard.press("Escape");
  await page.locator(".nav-item").first().click();
  assert.equal(
    await page
      .locator("img")
      .evaluateAll((images) =>
        images.every((i) => i.complete && i.naturalWidth > 0),
      ),
    true,
    "Documentation images must load",
  );
  await page.screenshot({
    path: `${target}/documentation.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 420, height: 900 });
  await page.getByLabel("Toggle navigation").click();
  assert.ok(await page.locator(".sidebar").isVisible());
  await page.locator(".nav-item").nth(1).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      previewScreens: 17,
      documentationPages: links,
      externalPreviewRequests: external.length,
      checks: [
        "demo mutations",
        "credential rejection",
        "speed-test blocked",
        "10 wallpapers",
        "offline viewer",
        "local search",
        "mobile navigation",
        "no browser errors",
      ],
    }),
  );
} finally {
  await browser.close();
}
