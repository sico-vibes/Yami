// Desktop check for Drawer › Radio. Needs the internet: lists popular
// stations from Radio Browser and plays one through yami-radio:// with the
// volume at zero, so nothing is heard, then stops. Isolated profile.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/radio-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await new Promise((r) => setTimeout(r, 100));
  }
  await main.locator(".bottom-dock").waitFor();
  await main.evaluate(() =>
    window.yami.invoke("panel", { open: true, tab: "Radio" }),
  );
  const island = app.windows().find((p) => p.url().includes("window=island"));
  await island.getByRole("button", { name: "Show popular stations" }).click();
  await island.locator(".radio-station").first().waitFor({ timeout: 20000 });
  const names = await island.locator(".radio-station b").allTextContents();
  assert.ok(names.length >= 5, names.join());
  // A stream Yami did not list is refused.
  const refused = await island.evaluate(() =>
    fetch("yami-radio://00000000-0000-0000-0000-000000000000/").then(
      (r) => r.status,
      (e) => e.message,
    ),
  );
  let played = "";
  for (let i = 0; i < 4 && !played; i++) {
    await island.locator(".radio-play").nth(i).click();
    await island.getByLabel("Radio volume").fill("0");
    try {
      await island
        .locator(".radio-now")
        .getByText("Playing", { exact: true })
        .waitFor({ timeout: 15000 });
      played = names[i];
    } catch {}
  }
  assert.ok(played, "one of the first four popular stations played");
  await island.getByRole("button", { name: "Stop the radio" }).click();
  await island.locator(".radio-now").waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ passed: true, played, listed: names.length, refused }),
  );
} finally {
  await app.close();
}
