// Desktop check for currency answers in the launcher. Needs the internet:
// asks Frankfurter for one real USD→EUR rate. Isolated profile.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/currency-verify-" + Date.now());
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
  const r = await main.evaluate(() =>
    window.yami.invoke("currency.convert", {
      amount: 100,
      from: "USD",
      to: "EUR",
    }),
  );
  assert.ok(r.rate > 0.3 && r.rate < 3, JSON.stringify(r));
  assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
  await main.evaluate(() =>
    window.yami.invoke("panel", { open: true, tab: "Apps" }),
  );
  const island = app.windows().find((p) => p.url().includes("window=island"));
  const box = island.getByLabel("Search apps");
  await box.waitFor();
  await box.fill("100 usd to eur");
  await island
    .getByText(/Rate from \d{4}-\d{2}-\d{2} \(Frankfurter\)/)
    .waitFor({ timeout: 10000 });
  const title = await island
    .getByText(/= .*€|= €/)
    .first()
    .textContent();
  console.log(
    JSON.stringify({ passed: true, rate: r.rate, date: r.date, shown: title }),
  );
} finally {
  await app.close();
}
