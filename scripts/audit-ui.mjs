// UI audit in the browser preview (no Windows access): walks the main pages,
// Desk's tabs, Tune, Settings' sections and the island drawer at 1160×790
// and 850×610, and reports layout and motion problems:
// - sideways overflow, and elements that reach past the window
// - text cut off without an ellipsis
// - click targets smaller than 24×24 px (WCAG 2.2 target size)
// - animations that keep running while nothing happens
// - script errors on the page
// It also saves a screenshot of each state for a visual review.
// Usage: node scripts/audit-ui.mjs [screenshot folder]   (preview on YAMI_PREVIEW_PORT)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const origin = `http://127.0.0.1:${Number(process.env.YAMI_PREVIEW_PORT) || 5174}/`;
const out = process.argv[2];
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const report = [];
// A script error on any page is a finding of its own.
const watch = (page, size) =>
  page.on("pageerror", (e) =>
    report.push({
      screen: "page error",
      size,
      issues: [["page-error", e.message]],
    }),
  );

const inspect = (frame) =>
  frame.evaluate(() => {
    const vw = innerWidth,
      vh = innerHeight;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width > 0 &&
        r.height > 0 &&
        s.visibility !== "hidden" &&
        s.display !== "none" &&
        Number(s.opacity) > 0.05
      );
    };
    const name = (el) =>
      (
        el.getAttribute("aria-label") ||
        el.textContent ||
        el.className ||
        el.tagName
      )
        .toString()
        .trim()
        .slice(0, 50);
    const shell = document.querySelector(".app-shell") || document.body;
    const issues = [];
    // A clipped shell cannot scroll, whatever its decorations reach.
    if (
      getComputedStyle(shell).overflowX !== "clip" &&
      shell.scrollWidth > shell.clientWidth + 1
    )
      issues.push([
        "overflow-x",
        `${shell.scrollWidth} > ${shell.clientWidth}`,
      ]);
    const targets = [
      ...document.querySelectorAll(
        "button, [role=switch], [role=tab], [role=combobox], input:not([type=hidden]), select, a[href]",
      ),
    ]
      .filter(visible)
      .map((el) => ({ el, r: el.getBoundingClientRect() }));
    // WCAG 2.5.8: a small target passes when a 24 px circle on its centre
    // touches no other target.
    const crowded = (el, r) => {
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      return targets.some(({ el: o, r: q }) => {
        if (o === el || o.contains(el) || el.contains(o)) return false;
        const dx = Math.max(q.left - cx, 0, cx - q.right),
          dy = Math.max(q.top - cy, 0, cy - q.bottom);
        return Math.hypot(dx, dy) < 12;
      });
    };
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      // Reaches past the window sideways (inside a scroller that scrolls sideways is fine).
      if ((r.right > vw + 1 || r.left < -1) && s.position !== "fixed") {
        let p = el.parentElement,
          scrolls = false;
        while (p) {
          const ps = getComputedStyle(p);
          if (
            /(auto|scroll)/.test(ps.overflowX) &&
            p.scrollWidth > p.clientWidth
          )
            scrolls = true;
          if (
            /(hidden|clip)/.test(ps.overflowX) &&
            p !== document.body &&
            p !== shell
          ) {
            const pr = p.getBoundingClientRect();
            if (pr.right <= vw + 1 && pr.left >= -1) scrolls = true;
          }
          p = p.parentElement;
        }
        if (!scrolls) issues.push(["past-window", name(el)]);
      }
      // Text cut off with no ellipsis.
      if (
        el.children.length === 0 &&
        el.textContent.trim() &&
        el.scrollWidth > el.clientWidth + 1 &&
        /(hidden|clip)/.test(s.overflowX) &&
        s.textOverflow !== "ellipsis" &&
        el.tagName !== "INPUT"
      )
        issues.push(["clipped-text", name(el)]);
      // Click targets smaller than 24 px (text links in sentences are exempt).
      const interactive = el.matches(
        "button, [role=switch], [role=tab], [role=combobox], input:not([type=hidden]), select, a[href]",
      );
      if (
        interactive &&
        (r.width < 24 || r.height < 24) &&
        !el.closest("p, li small") &&
        crowded(el, r)
      )
        issues.push([
          "small-target",
          `${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`,
        ]);
    }
    const looping = document
      .getAnimations()
      .filter(
        (a) =>
          a.playState === "running" &&
          a.effect?.getTiming().iterations === Infinity,
      )
      .map((a) =>
        (a.effect?.target?.className || a.animationName || "animation")
          .toString()
          .slice(0, 50),
      );
    for (const l of new Set(looping)) issues.push(["looping-animation", l]);
    return issues;
  });

const record = async (page, frame, label, size) => {
  await page.waitForTimeout(450);
  const issues = await inspect(frame);
  report.push({ screen: label, size, issues });
  if (out)
    await page.screenshot({
      path: path.join(out, `${label.replace(/[^a-z0-9]+/gi, "-")}-${size}.png`),
    });
};

for (const [w, h] of [
  [1160, 790],
  [850, 610],
]) {
  const size = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  watch(page, size);
  page.setDefaultTimeout(6000);
  await page.goto(origin + "?window=main");
  await page.waitForTimeout(1500);
  const frame = page.frames()[1] || page.mainFrame();
  const dock = async (name) =>
    frame.getByRole("button", { name, exact: true }).click();
  for (const tab of [
    "Home",
    "Bond",
    "Soul",
    "Desk",
    "Tune",
    "AI",
    "Settings",
  ]) {
    try {
      await dock(tab);
      await record(page, frame, tab, size);
      if (tab === "Desk")
        for (const sub of ["Inbox", "Downloads"]) {
          await frame.getByRole("tab", { name: sub }).click();
          await record(page, frame, `Desk ${sub}`, size);
        }
      if (tab === "Settings")
        for (const section of [
          "Shortcuts",
          "Behavior",
          "System",
          "API keys",
          "Your data",
          "Privacy",
          "File wheel",
          "Modules",
          "Phone",
          "Music",
        ])
          try {
            await frame
              .locator(".settings-sidebar nav button", { hasText: section })
              .first()
              .click();
            await record(page, frame, `Settings ${section}`, size);
          } catch (e) {
            report.push({
              screen: `Settings ${section}`,
              size,
              issues: [["could-not-open", e.message.split("\n")[0]]],
            });
          }
    } catch (e) {
      report.push({
        screen: tab,
        size,
        issues: [["could-not-open", e.message.split("\n")[0]]],
      });
    }
  }
  await page.close();
}
// The island drawer's tabs, through the preview's screen picker.
const page = await browser.newPage({ viewport: { width: 1460, height: 1040 } });
watch(page, "island");
page.setDefaultTimeout(6000);
await page.goto(origin);
await page.frameLocator("#preview-frame").locator(".bottom-dock").waitFor();
for (const screen of [
  "Island",
  "Controls",
  "Today",
  "Stats",
  "Clipboard",
  "Apps",
  "Wallpaper",
  "Power",
  "Radio",
  "Desk widget",
]) {
  try {
    await page.getByLabel("Preview screen").selectOption(screen);
    await page.waitForTimeout(500);
    const frame =
      page.frames().find((f) => f !== page.mainFrame()) || page.mainFrame();
    await record(page, frame, `Drawer ${screen}`, "island");
  } catch (e) {
    report.push({
      screen,
      size: "island",
      issues: [["could-not-open", e.message.split("\n")[0]]],
    });
  }
}
await browser.close();
const total = report.reduce((n, r) => n + r.issues.length, 0);
console.log(
  JSON.stringify(
    {
      states: report.length,
      issues: total,
      report: report.filter((r) => r.issues.length),
    },
    null,
    1,
  ),
);
