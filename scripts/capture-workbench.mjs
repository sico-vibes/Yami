import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1160, height: 790 } });
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:5174/"))
    external.push(r.url());
});
try {
  await page.goto("http://127.0.0.1:5174/?stage=1&screen=AI");
  await page.getByRole("heading", { name: "Agent sessions" }).waitFor();
  await page.waitForTimeout(350);
  await page.screenshot({
    path: "docs/internal/assets/screenshots/workspace.png",
  });
  for (const width of [1160, 850]) {
    await page.setViewportSize({ width, height: 790 });
    for (const name of [
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
      await page
        .getByRole("navigation", { name: "AI sections" })
        .getByRole("button", { name, exact: true })
        .click();
      await page.locator(".settings-content h1").waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        name + " at " + width,
      );
    }
  }
  await page.setViewportSize({ width: 1000, height: 650 });
  await page.goto("http://127.0.0.1:5174/?stage=1&screen=Terminal");
  await page.getByText("Preview 1", { exact: true }).waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "docs/internal/assets/screenshots/terminal.png",
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    JSON.stringify({
      passed: true,
      source: "Synthetic browser fixtures",
      widths: [1160, 850],
      screenshots: ["workspace.png", "terminal.png"],
    }),
  );
} finally {
  await browser.close();
}
