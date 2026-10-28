// Desktop check for the Desk inbox against real public feeds (needs the
// internet): Hacker News, a GitHub repository's releases and a subreddit.
// Read-only: nothing signs in or posts. Uses an isolated profile.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/feeds-verify-" + Date.now());
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
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  await assert.rejects(call("feeds.list"), /turned off/);
  await call("modules.set", { id: "feeds", enabled: true });
  await call("feeds.add", { kind: "hackernews", value: "" });
  await call("feeds.add", { kind: "github", value: "electron/electron" });
  await call("feeds.add", { kind: "reddit", value: "r/rust" });
  await call("feeds.add", { kind: "bluesky", value: "bsky.app" });
  await call("feeds.add", { kind: "mastodon", value: "@Mastodon@mastodon.social" });
  await assert.rejects(
    call("feeds.add", { kind: "url", value: "http://insecure.example/feed" }),
    /https/,
  );
  const view = await call("feeds.refresh");
  const report = view.sources.map((s) => {
    const status = view.status.find((x) => x.id === s.id);
    return {
      name: s.name,
      state: status.state,
      items: view.items.filter((i) => i.source === s.id).length,
      error: status.error,
    };
  });
  const hn = report.find((r) => r.name === "Hacker News");
  assert.equal(hn.state, "fresh", hn.error);
  assert.ok(hn.items > 0, "Hacker News returned items");
  assert.ok(view.items.every((i) => /^https?:\/\//.test(i.link)));
  // The Inbox renders the cached items.
  await main.getByRole("button", { name: "Desk", exact: true }).click();
  await main.getByRole("tab", { name: "Inbox" }).click();
  await main.locator(".inbox-item").first().waitFor({ timeout: 15000 });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, feeds: report }));
} finally {
  await app.close();
}
