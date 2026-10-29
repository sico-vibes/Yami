// Desktop check for Yami's download manager, against a local server only:
// a 5 MB file is pasted into Desk › Downloads and fetched in parts; then a
// download link opened in the Yami Browser is caught by the manager instead
// of Chromium. Files land in the isolated profile. Isolated profile.
import { _electron } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/downloads-verify-" + Date.now());
skipSetup(profile);
const folder = path.join(profile, "Downloads");
const body = crypto.randomBytes(5 * 1024 * 1024 + 77);
const ranges = [];
const server = http.createServer((req, res) => {
  if (req.url === "/page")
    return res.end('<a id="go" href="/file.bin?from=browser" download>get</a>');
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
  ranges.push(req.headers.range || "none");
  const start = m ? Number(m[1]) : 0,
    end = m && m[2] ? Number(m[2]) : body.length - 1;
  res.writeHead(m ? 206 : 200, {
    "content-length": end - start + 1,
    "content-disposition": 'attachment; filename="sample.bin"',
    ...(m && { "content-range": `bytes ${start}-${end}/${body.length}` }),
  });
  res.end(body.subarray(start, end + 1));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (m, a) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  await call("downloads.settings", { folder });
  await main.getByRole("button", { name: "Desk", exact: true }).click();
  await main.getByRole("tab", { name: "Downloads" }).click();
  await main.getByLabel("Download link").fill(`${base}/file.bin`);
  await main.getByRole("button", { name: "Download", exact: true }).click();
  await main
    .getByText("sample.bin", { exact: true })
    .waitFor({ timeout: 15000 });
  let job;
  for (let i = 0; i < 100; i++) {
    job = (await call("downloads")).jobs[0];
    if (job.state === "done") break;
    await wait(100);
  }
  assert.equal(job.state, "done", job.error);
  assert.ok(job.parts.length >= 4, "fetched in parts");
  assert.ok(ranges.filter((r) => r.startsWith("bytes=")).length >= 5);
  const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
  assert.equal(sha(fs.readFileSync(job.file)), sha(body));
  // The Yami Browser hands its downloads to the manager.
  await call("modules.set", { id: "browser", enabled: true });
  await call("browser.show", { url: `${base}/file.bin?from=browser` });
  let caught;
  for (let i = 0; i < 100 && !caught; i++) {
    caught = (await call("downloads")).jobs.find((j) =>
      j.url.includes("from=browser"),
    );
    if (!caught) await wait(100);
  }
  assert.ok(caught, "the browser's download is in Yami's list");
  for (let i = 0; i < 100 && caught.state !== "done"; i++) {
    await wait(100);
    caught = (await call("downloads")).jobs.find((j) =>
      j.url.includes("from=browser"),
    );
  }
  assert.equal(caught.state, "done", caught.error);
  assert.equal(sha(fs.readFileSync(caught.file)), sha(body));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      parts: job.parts.length,
      files: fs.readdirSync(folder),
    }),
  );
} finally {
  await app.close();
  server.close();
}
