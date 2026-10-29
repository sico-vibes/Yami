import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BlueskyHome, posts } from "../electron/feeds/bluesky.ts";

const feed = [
  {
    post: {
      uri: "at://did:plc:bob/app.bsky.feed.post/3kabc",
      author: { handle: "bob.bsky.social", displayName: "Bob" },
      record: { text: "Hello from Bob", createdAt: "2026-10-29T08:00:00Z" },
    },
  },
  {
    post: {
      uri: "at://did:plc:cy/app.bsky.feed.post/3kdef",
      author: { handle: "cy.example.com" },
      record: { text: "A repost", createdAt: "2026-10-29T07:00:00Z" },
    },
    reason: {
      $type: "app.bsky.feed.defs#reasonRepost",
      by: { handle: "dee.bsky.social", displayName: "Dee" },
    },
  },
  { post: { uri: "at://x/app.bsky.feed.like/1", author: { handle: "x" } } },
  {
    post: {
      uri: "at://x/app.bsky.feed.post/2",
      author: { handle: "bad handle!" },
    },
  },
];

test("timeline entries become plain posts with bsky.app links", () => {
  assert.deepEqual(posts(feed), [
    {
      id: "at://did:plc:bob/app.bsky.feed.post/3kabc",
      author: "Bob",
      handle: "bob.bsky.social",
      text: "Hello from Bob",
      link: "https://bsky.app/profile/bob.bsky.social/post/3kabc",
      at: Date.parse("2026-10-29T08:00:00Z"),
    },
    {
      id: "at://did:plc:cy/app.bsky.feed.post/3kdef",
      author: "cy.example.com",
      handle: "cy.example.com",
      text: "A repost",
      link: "https://bsky.app/profile/cy.example.com/post/3kdef",
      at: Date.parse("2026-10-29T07:00:00Z"),
      note: "Reposted by Dee",
    },
  ]);
  assert.deepEqual(posts(null), []);
});

test("sign-in keeps only the refresh token, and an expired session renews", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-bsky-"));
  const secrets = new Map();
  const calls = [];
  let expire = false,
    sessions = 0;
  const session = () => ({
    accessJwt: "access-" + ++sessions,
    refreshJwt: "refresh-" + sessions,
    handle: "ana.bsky.social",
    did: "did:plc:ana",
    didDoc: {
      service: [
        {
          type: "AtprotoPersonalDataServer",
          serviceEndpoint: "https://pds.example",
        },
      ],
    },
  });
  const fetcher = async (url, init = {}) => {
    const auth = init.headers?.authorization || "";
    calls.push([String(url).replace(/\?.*$/, ""), auth]);
    const json = (v, status = 200) =>
      new Response(JSON.stringify(v), { status });
    if (url.endsWith("createSession")) {
      const body = JSON.parse(init.body);
      return body.password === "abcd-efgh-ijkl-mnop"
        ? json(session())
        : json({ error: "AuthFactorTokenRequired" }, 401);
    }
    if (url.endsWith("refreshSession")) return json(session());
    if (url.includes("getTimeline")) {
      if (expire) {
        expire = false;
        return json({ error: "ExpiredToken" }, 400);
      }
      return json({ feed });
    }
    return json({}, 404);
  };
  const store = {
    get: (k) => secrets.get(k) || "",
    set: (k, v) => secrets.set(k, v),
  };
  const file = path.join(dir, "bluesky.json");
  const home = new BlueskyHome(file, store, fetcher);
  await assert.rejects(
    home.signIn("ana.bsky.social", "my-main-password"),
    /app password/,
  );
  await assert.rejects(
    home.signIn("ana.bsky.social", "zzzz-zzzz-zzzz-zzzz"),
    /refused/,
  );
  let status = await home.signIn("@ana.bsky.social", "abcd-efgh-ijkl-mnop");
  assert.equal(status.handle, "ana.bsky.social");
  assert.equal(status.posts.length, 2);
  assert.equal(secrets.get("bluesky"), "refresh-1");
  const saved = fs.readFileSync(file, "utf8");
  assert.ok(
    !saved.includes("refresh") && !saved.includes("access"),
    "no tokens in bluesky.json",
  );
  assert.deepEqual(calls.at(-1), [
    "https://pds.example/xrpc/app.bsky.feed.getTimeline",
    "Bearer access-1",
  ]);
  // An expired access token renews with the refresh token and reads again.
  expire = true;
  status = await home.refresh();
  assert.equal(status.error, undefined);
  assert.deepEqual(
    calls.slice(-3).map((c) => c[1]),
    ["Bearer access-1", "Bearer refresh-1", "Bearer access-2"],
  );
  assert.equal(secrets.get("bluesky"), "refresh-2");
  // A new start has no access token in memory: it renews first.
  const again = new BlueskyHome(file, store, fetcher);
  assert.equal((await again.refresh()).posts.length, 2);
  assert.equal(
    calls.at(-2)[0],
    "https://pds.example/xrpc/com.atproto.server.refreshSession",
  );
  assert.equal(again.signOut().handle, undefined);
  assert.equal(secrets.get("bluesky"), "");
  fs.rmSync(dir, { recursive: true, force: true });
});
