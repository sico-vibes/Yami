// Desktop check for Tune › Hosts file, on a copy: YAMI_HOSTS_FILE points the
// page at a copy of this PC's hosts file, written directly instead of with
// an administrator prompt. The page adds an entry, switches it off, and
// puts the file back. The real hosts file is compared before and after.
// --live uses the real hosts file instead: two administrator prompts (add,
// then Put back), a check that Windows answers the name with 0.0.0.0, and
// the file must end exactly as it started.
import { _electron } from "playwright";
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const real = path.join(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "drivers",
  "etc",
  "hosts",
);
const realBefore = fs.readFileSync(real, "utf8");
const profile = path.resolve(".artifacts/hosts-verify-" + Date.now());
skipSetup(profile);
const live = process.argv.includes("--live");
const copy = live ? real : path.join(profile, "hosts");
// A safety copy of the real file, whatever happens below.
fs.writeFileSync(path.join(profile, "hosts.before"), realBefore);
if (!live) fs.writeFileSync(copy, realBefore);
const env = { ...process.env, YAMI_DATA_DIR: profile };
if (!live) env.YAMI_HOSTS_FILE = copy;
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
    window.yami.invoke("modules.set", { id: "tune", enabled: true }),
  );
  await main.getByRole("button", { name: "Tune", exact: true }).click();
  await main.getByRole("button", { name: "Show entries" }).click();
  // Windows answers a 0.0.0.0 entry as "not found", the same as a name that
  // does not exist, so the live run uses 127.0.0.1, which it does return.
  const address = live ? "127.0.0.1" : "0.0.0.0";
  if (live) await main.getByLabel("Address").fill(address);
  await main.getByLabel("Host name").fill("yami-verify.example.com");
  await main.getByRole("button", { name: "Add", exact: true }).click();
  // Live: waits for the administrator prompt to be answered.
  await main
    .getByText("yami-verify.example.com", { exact: true })
    .waitFor({ timeout: live ? 120000 : 30000 });
  assert.ok(
    fs
      .readFileSync(copy, "utf8")
      .includes(`${address}\tyami-verify.example.com`),
    "the entry is in the file",
  );
  let answered;
  if (live)
    // Read now, judged after Put back so the real file is always restored.
    answered = await dns
      .lookup("yami-verify.example.com", { family: 4 })
      .then((r) => r.address)
      .catch((e) => e.code);
  else {
    await main
      .getByRole("switch", { name: "Use yami-verify.example.com" })
      .click();
    await main.waitForTimeout(500);
    assert.match(
      fs.readFileSync(copy, "utf8"),
      /# 0\.0\.0\.0\tyami-verify\.example\.com/,
    );
  }
  await main.getByRole("button", { name: "Put back" }).click();
  await main
    .getByRole("button", { name: "Put back" })
    .waitFor({ state: "detached", timeout: live ? 120000 : 30000 });
  if (live)
    assert.equal(answered, address, "Windows answered from the hosts file");
  assert.equal(
    fs.readFileSync(copy, "utf8"),
    realBefore,
    "the copy is exactly as before",
  );
  assert.equal(
    fs.readFileSync(real, "utf8"),
    realBefore,
    "the real hosts file is untouched",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, live, answered }));
} finally {
  // Live run stopped early: put the real file back through Yami once more.
  if (live && fs.readFileSync(real, "utf8") !== realBefore)
    await app
      .evaluate(() => {})
      .then(() =>
        app
          .windows()
          .find((p) => p.url().includes("window=main"))
          ?.evaluate(() => window.yami.invoke("tune.hosts.restore")),
      )
      .catch((e) => console.error("Restore failed:", e.message));
  await app.close();
  if (live && fs.readFileSync(real, "utf8") !== realBefore)
    console.error(
      "The hosts file differs from before. A copy is at " +
        path.join(profile, "hosts.before"),
    );
}
