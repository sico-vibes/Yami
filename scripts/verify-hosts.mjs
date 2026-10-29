// Desktop check for Tune › Hosts file, on a copy: YAMI_HOSTS_FILE points the
// page at a copy of this PC's hosts file, written directly instead of with
// an administrator prompt. The page adds an entry, switches it off, and
// puts the file back. The real hosts file is compared before and after.
import { _electron } from "playwright";
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
const copy = path.join(profile, "hosts");
fs.writeFileSync(copy, realBefore);
const env = { ...process.env, YAMI_DATA_DIR: profile, YAMI_HOSTS_FILE: copy };
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
  await main.getByLabel("Host name").fill("yami-verify.example.com");
  await main.getByRole("button", { name: "Add", exact: true }).click();
  await main.getByText("yami-verify.example.com", { exact: true }).waitFor();
  assert.match(
    fs.readFileSync(copy, "utf8"),
    /0\.0\.0\.0\tyami-verify\.example\.com/,
  );
  await main
    .getByRole("switch", { name: "Use yami-verify.example.com" })
    .click();
  await main.waitForTimeout(500);
  assert.match(
    fs.readFileSync(copy, "utf8"),
    /# 0\.0\.0\.0\tyami-verify\.example\.com/,
  );
  await main.getByRole("button", { name: "Put back" }).click();
  await main
    .getByRole("button", { name: "Put back" })
    .waitFor({ state: "detached" });
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
  console.log(JSON.stringify({ passed: true }));
} finally {
  await app.close();
}
