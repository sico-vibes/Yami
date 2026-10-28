import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FilterLists } from "../electron/browser/filter-lists.ts";
import { buildEngineFile } from "../electron/browser/filter-engine.ts";

const lists = {
  "easylist.txt":
    "[Adblock Plus 2.0]\n! Title: test\n||ads.example.com^\n##.ad-banner\nnews.example.org##.sponsor\n",
  "easyprivacy.txt": "[Adblock Plus 2.0]\n||track.example.net^$third-party\n",
};

function fakeFetch() {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const name = url.split("/").pop();
    if (init.headers["If-None-Match"] === '"v1"')
      return new Response(null, { status: 304 });
    return new Response(lists[name], {
      status: 200,
      headers: { etag: '"v1"' },
    });
  };
  return { fn, calls };
}

test("filter lists download, block subresources, hide ads and refresh politely", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-filters-"));
  const { fn, calls } = fakeFetch();
  const filters = new FilterLists(
    path.join(dir, "filters"),
    fn,
    buildEngineFile,
  );
  assert.equal(filters.status().installed, false);
  assert.equal(await filters.get(), undefined, "nothing before a download");
  const status = await filters.update();
  assert.equal(status.error, undefined);
  assert.equal(status.installed, true);
  assert.equal(status.rules, 4);
  const sub = (url, type = "script") => ({
    url,
    referrer: "https://news.example.org/story",
    resourceType: type,
  });
  assert.equal(filters.blocks(sub("https://ads.example.com/a.js")), true);
  assert.equal(
    filters.blocks(sub("https://track.example.net/p.gif", "image")),
    true,
  );
  assert.equal(filters.blocks(sub("https://cdn.example.org/app.js")), false);
  assert.equal(
    filters.blocks(sub("https://ads.example.com/", "mainFrame")),
    false,
    "a page the user opens is never blocked",
  );
  const names = (classes) => ({ classes, ids: [], hrefs: [] });
  const css = filters.hidingCss(
    "https://news.example.org/story",
    names(["ad-banner", "article"]),
  );
  assert.match(css, /\.ad-banner/, "generic rule for a class on the page");
  assert.match(css, /\.sponsor/, "rule for this site");
  assert.doesNotMatch(
    filters.hidingCss("https://news.example.org/", names(["article"])),
    /\.ad-banner/,
    "no generic rule for classes the page does not use",
  );
  assert.doesNotMatch(
    filters.hidingCss("https://other.example.com/"),
    /\.sponsor/,
  );
  // A fresh start reads the saved engine instead of parsing again.
  const again = new FilterLists(path.join(dir, "filters"), fn, buildEngineFile);
  assert.ok(await again.get());
  assert.equal(again.status().rules, 4);
  // Not stale yet; a week later it refreshes with the saved ETag (304).
  assert.equal(again.refreshIfStale(), false);
  assert.equal(again.refreshIfStale(Date.now() + 8 * 86400_000), true);
  await again.update();
  assert.equal(calls.at(-1).headers["If-None-Match"], '"v1"');
  assert.equal(again.status().rules, 4, "a 304 keeps the counts");
  // Something that is not a filter list is refused and nothing changes.
  const bad = new FilterLists(
    path.join(dir, "bad"),
    async () => new Response("<html>login</html>"),
  );
  assert.match((await bad.update()).error, /did not look like a filter list/);
  assert.equal(bad.status().installed, false);
  assert.equal((await filters.remove()).installed, false);
  assert.equal(filters.blocks(sub("https://ads.example.com/a.js")), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
