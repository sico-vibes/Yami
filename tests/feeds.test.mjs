import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { feedAddress, parseFeed, plain } from "../electron/feeds/parse.ts";
import { FeedsController } from "../electron/feeds/feeds.ts";

const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Demo</title>
<item><title>First &amp; best</title><link>https://example.com/a</link>
<guid>a-1</guid><pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate>
<description><![CDATA[<p>Hello <b>world</b> &lt;script&gt;</p>]]></description>
<dc:creator>Ada</dc:creator></item>
<item><title>Unsafe</title><link>javascript:alert(1)</link></item>
<item><title><![CDATA[Second]]></title><link><![CDATA[https://example.com/b]]></link></item>
</channel></rss>`;
const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><id>tag:github.com,2008:Repository/1/v1.2.0</id><title>v1.2.0</title>
<link rel="alternate" type="text/html" href="https://github.com/o/r/releases/tag/v1.2.0"/>
<updated>2026-10-26T08:00:00Z</updated><author><name>octo</name></author>
<content type="html">&lt;p&gt;Notes&lt;/p&gt;</content></entry></feed>`;

test("RSS items keep safe links and plain text only", () => {
  const items = parseFeed(rss, "s1");
  assert.equal(items.length, 2, "the javascript: link is dropped");
  assert.equal(items[0].title, "First & best");
  assert.equal(items[0].id, "s1:a-1");
  assert.equal(items[0].summary, "Hello world", "escaped tags are dropped too");
  assert.equal(items[0].author, "Ada");
  assert.equal(items[0].at, Date.parse("2026-10-27T10:00:00Z"));
  assert.equal(items[1].link, "https://example.com/b");
  assert.equal(items[1].at, 0, "no date sorts last");
});

test("Atom and JSON Feed entries are read", () => {
  const [release] = parseFeed(atom, "gh");
  assert.equal(release.title, "v1.2.0");
  assert.equal(release.link, "https://github.com/o/r/releases/tag/v1.2.0");
  assert.equal(release.author, "octo");
  assert.equal(release.summary, "Notes");
  const json = JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    items: [
      {
        id: "1",
        url: "https://example.com/j",
        title: "Json",
        date_published: "2026-10-28T00:00:00Z",
      },
    ],
  });
  assert.equal(parseFeed(json, "j")[0].link, "https://example.com/j");
  assert.throws(() => parseFeed("<html></html>", "x"), /did not return/);
  assert.throws(() => parseFeed('{"a":1}', "x"), /not a JSON Feed/);
  assert.equal(plain("x".repeat(400), 10).length, 10);
});

test("feed addresses are built from what you type and validated", () => {
  assert.deepEqual(feedAddress("reddit", "r/rust"), {
    url: "https://www.reddit.com/r/rust/.rss",
    name: "r/rust",
  });
  assert.throws(() => feedAddress("reddit", "r/../evil"), /subreddit/);
  assert.equal(
    feedAddress("github", "https://github.com/electron/electron/").url,
    "https://github.com/electron/electron/releases.atom",
  );
  assert.throws(() => feedAddress("github", "a/b/c"), /owner\/repo/);
  assert.throws(() => feedAddress("youtube", "UC123"), /channel ID/);
  assert.throws(() => feedAddress("url", "http://plain.example/feed"), /https/);
  assert.throws(
    () => feedAddress("url", "https://user:pw@example.com/feed"),
    /credentials/,
  );
  assert.equal(
    feedAddress("hackernews", "").url,
    "https://news.ycombinator.com/rss",
  );
});

test("refresh sends ETags, keeps the cache on errors and merges newest first", async () => {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "yami-feeds-")),
    "feeds.json",
  );
  const seen = [];
  let mode = "ok";
  const fetchImpl = async (url, init) => {
    seen.push({ url, etag: init.headers["If-None-Match"] });
    if (mode === "304") return new Response(null, { status: 304 });
    if (mode === "fail") return new Response("busy", { status: 429 });
    return new Response(url.includes("github") ? atom : rss, {
      headers: { etag: '"v1"' },
    });
  };
  const feeds = new FeedsController(file, fetchImpl);
  const a = feeds.add("url", "https://example.com/feed.xml");
  assert.equal(feeds.add("url", "https://example.com/feed.xml").id, a.id);
  feeds.add("github", "o/r");
  let view = await feeds.refresh();
  assert.equal(view.items.length, 3);
  assert.ok(view.items[0].at >= view.items[1].at, "newest first");
  mode = "304";
  view = await new FeedsController(file, fetchImpl).refresh();
  assert.equal(seen.at(-1).etag, '"v1"', "the saved ETag is sent");
  assert.equal(view.items.length, 3, "304 keeps the items");
  mode = "fail";
  const again = new FeedsController(file, fetchImpl);
  view = await again.refresh(a.id);
  assert.equal(view.status.find((s) => s.id === a.id).state, "error");
  assert.match(view.status.find((s) => s.id === a.id).error, /slow down/);
  assert.equal(view.items.length, 3, "items survive a failed read");
  view = again.remove(a.id);
  assert.equal(view.sources.length, 1);
  assert.equal(view.items.length, 1);
});

test("Bluesky and Mastodon accounts become their public RSS feeds", () => {
  assert.deepEqual(feedAddress("bluesky", "@Bsky.App"), {
    url: "https://bsky.app/profile/bsky.app/rss",
    name: "@bsky.app",
  });
  assert.throws(() => feedAddress("bluesky", "not a handle"), /Bluesky handle/);
  assert.throws(
    () => feedAddress("bluesky", "evil/../x.com"),
    /Bluesky handle/,
  );
  assert.deepEqual(feedAddress("mastodon", "@Gargron@Mastodon.Social"), {
    url: "https://mastodon.social/@Gargron.rss",
    name: "@Gargron@mastodon.social",
  });
  assert.throws(() => feedAddress("mastodon", "@user"), /Mastodon account/);
  assert.throws(
    () => feedAddress("mastodon", "@u@host/evil"),
    /Mastodon account/,
  );
});

test("untitled social posts use their text as the title", () => {
  const post = `<rss version="2.0"><channel><item><link>https://bsky.app/profile/x/post/1</link>
<description>Hello from Bluesky &amp; friends</description><pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate>
<guid>at://x/1</guid></item></channel></rss>`;
  const [item] = parseFeed(post, "b");
  assert.equal(item.title, "Hello from Bluesky & friends");
  assert.equal(item.summary, undefined, "not repeated as a summary");
});
