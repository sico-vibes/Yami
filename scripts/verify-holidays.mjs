// Desktop check for public holidays in Today. Needs the internet: asks
// Nager.Date once for this PC's region (Windows' region setting) and year.
// Isolated profile.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/holidays-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await new Promise((r) => setTimeout(r, 100));
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  const year = new Date().getFullYear();
  await assert.rejects(
    call("holidays", { year }),
    /off/,
    "off by default: nothing is fetched",
  );
  await main.evaluate(() =>
    window.yami.invoke("panel", { open: true, tab: "Today" }),
  );
  const island = app.windows().find((p) => p.url().includes("window=island"));
  await island.getByRole("button", { name: "Show public holidays" }).click();
  await island
    .getByRole("button", { name: "Show public holidays" })
    .waitFor({ state: "detached" });
  const r = await call("holidays", { year });
  assert.match(r.country, /^[A-Z]{2}$/, "Windows region read");
  assert.ok(
    r.holidays.length > 0,
    `Nager.Date listed holidays for ${r.country}`,
  );
  assert.ok(
    r.holidays.every((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.name),
  );
  console.log(
    JSON.stringify({
      passed: true,
      country: r.country,
      count: r.holidays.length,
      first: r.holidays[0],
    }),
  );
} finally {
  await app.close();
}
