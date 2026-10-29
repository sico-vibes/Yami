import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { searchPodcasts } from "../electron/feeds/podcasts.ts";
import { FeedsController } from "../electron/feeds/feeds.ts";

test("podcast search keeps HTTPS feeds once, and following one adds it by name", async () => {
  let url = "";
  const shows = await searchPodcasts("night sky", async (u) => {
    url = String(u);
    return new Response(
      JSON.stringify({
        results: [
          {
            collectionName: "Night Sky",
            artistName: "Ana",
            feedUrl: "https://example.com/sky.xml",
          },
          {
            collectionName: "Night Sky again",
            artistName: "Ana",
            feedUrl: "https://example.com/sky.xml",
          },
          {
            collectionName: "Plain",
            artistName: "Bo",
            feedUrl: "http://example.com/plain.xml",
          },
          { collectionName: "No feed", artistName: "Cy" },
        ],
      }),
    );
  });
  assert.equal(
    url,
    "https://itunes.apple.com/search?media=podcast&entity=podcast&limit=8&term=night%20sky",
  );
  assert.deepEqual(shows, [
    { name: "Night Sky", author: "Ana", feed: "https://example.com/sky.xml" },
  ]);
  await assert.rejects(searchPodcasts("x"), /podcast name/);
  await assert.rejects(
    searchPodcasts("night sky", async () => new Response("", { status: 403 })),
    /slow down/,
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-pod-"));
  const feeds = new FeedsController(path.join(dir, "feeds.json"));
  const source = feeds.add("podcast", shows[0].feed, shows[0].name);
  assert.deepEqual(
    [source.kind, source.name, source.url],
    ["podcast", "Night Sky", "https://example.com/sky.xml"],
  );
  assert.throws(
    () => feeds.add("podcast", "http://example.com/plain.xml", "Plain"),
    /https/,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
