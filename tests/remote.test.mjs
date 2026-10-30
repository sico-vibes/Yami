import test from "node:test";
import assert from "node:assert/strict";
import { lanAddress, startRemote } from "../electron/remote/server.ts";

test("the remote listens only on a private home-network address", () => {
  assert.equal(
    lanAddress({
      lo: [{ family: "IPv4", internal: true, address: "127.0.0.1" }],
      vpn: [{ family: "IPv4", internal: false, address: "100.64.1.2" }],
      wifi: [
        { family: "IPv6", internal: false, address: "fe80::1" },
        { family: "IPv4", internal: false, address: "192.168.1.20" },
      ],
    }),
    "192.168.1.20",
  );
  assert.equal(
    lanAddress({
      public: [{ family: "IPv4", internal: false, address: "8.8.8.8" }],
    }),
    "",
  );
  assert.equal(
    lanAddress({
      corp: [{ family: "IPv4", internal: false, address: "172.20.0.5" }],
    }),
    "172.20.0.5",
  );
});

test("the phone API needs the token and respects each ability", async () => {
  const calls = [];
  let allowed = new Set(["approvals", "media"]);
  const link = startRemote(
    {
      token: () => "pairing-token",
      allowed: (n) => allowed.has(n),
      state: async () => ({ agents: [], requests: [{ id: "r1" }] }),
      approve: (id, decision) => calls.push(["approve", id, decision]),
      media: async (action) => (
        calls.push(["media", action]), { active: true }
      ),
      clipboard: (text) => calls.push(["clip", text]),
    },
    "127.0.0.1",
    47898,
  );
  await link.ready;
  try {
    const base = "http://127.0.0.1:47898";
    const page = await fetch(base + "/");
    assert.equal(page.status, 200);
    assert.match(
      page.headers.get("content-security-policy"),
      /default-src 'none'/,
    );
    assert.match(await page.text(), /Yami Remote/);
    const call = (path, body, token = "pairing-token") =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: body && JSON.stringify(body),
      });
    assert.equal(
      (await call("/api/state", undefined, "wrong-token-x")).status,
      401,
    );
    assert.equal((await fetch(base + "/api/state")).status, 401);
    assert.deepEqual((await (await call("/api/state")).json()).requests, [
      { id: "r1" },
    ]);
    assert.equal(
      (await call("/api/approve", { id: "r1", decision: "maybe" })).status,
      400,
    );
    assert.equal(
      (await call("/api/approve", { id: "r1", decision: "allow" })).status,
      200,
    );
    assert.equal((await call("/api/media", { action: "toggle" })).status, 200);
    assert.equal(
      (await call("/api/clipboard", { text: "hi" })).status,
      403,
      "clipboard off by default",
    );
    allowed = new Set(["clipboard"]);
    assert.equal((await call("/api/clipboard", { text: "hi" })).status, 200);
    assert.equal(
      (await call("/api/approve", { id: "r1", decision: "deny" })).status,
      403,
    );
    assert.equal(
      (await call("/api/clipboard", { text: "x".repeat(10001) })).status,
      400,
    );
    assert.deepEqual(calls, [
      ["approve", "r1", "allow"],
      ["media", "toggle"],
      ["clip", "hi"],
    ]);
  } finally {
    await link.close();
  }
});

test("without a home-network address the remote says why", async () => {
  const link = startRemote(
    {
      token: () => "t",
      allowed: () => true,
      state: async () => ({}),
      approve() {},
      media: async () => ({}),
      clipboard() {},
    },
    "",
  );
  await assert.rejects(link.ready, /no home-network address/);
});

test("screen view and control are separate abilities with checked input", async () => {
  const { parseRemoteInput } = await import("../electron/remote/input.ts");
  assert.deepEqual(parseRemoteInput({ kind: "click", x: 0.5, y: 0.25 }), {
    method: "remoteClick",
    args: { x: 0.5, y: 0.25, button: "left" },
  });
  assert.equal(
    parseRemoteInput({ kind: "key", key: "enter" }).args.key,
    "enter",
  );
  assert.throws(
    () => parseRemoteInput({ kind: "click", x: 2, y: 0 }),
    /inside/,
  );
  assert.throws(
    () => parseRemoteInput({ kind: "key", key: "f4" }),
    /not offered/,
  );
  assert.throws(() => parseRemoteInput({ kind: "scroll", notches: 50 }), /ten/);
  assert.throws(() => parseRemoteInput({ kind: "type", text: "" }), /2,000/);
  assert.throws(
    () => parseRemoteInput({ kind: "run", command: "calc" }),
    /Unknown/,
  );
  const inputs = [];
  let allowed = new Set();
  const link = startRemote(
    {
      token: () => "t0k3n",
      allowed: (n) => allowed.has(n),
      state: async () => ({}),
      approve: () => {},
      media: async () => ({}),
      clipboard: () => {},
      frame: async () => Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      input: async (body) => {
        inputs.push(parseRemoteInput(body));
      },
    },
    "127.0.0.1",
    47899,
  );
  await link.ready;
  try {
    const base = "http://127.0.0.1:47899";
    const auth = { Authorization: "Bearer t0k3n" };
    const tap = () =>
      fetch(base + "/api/input", {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ kind: "click", x: 0.1, y: 0.2 }),
      });
    assert.equal(
      (await fetch(base + "/api/screen", { headers: auth })).status,
      403,
    );
    assert.equal((await fetch(base + "/api/screen")).status, 401);
    allowed = new Set(["screen"]);
    const shot = await fetch(base + "/api/screen", { headers: auth });
    assert.equal(shot.headers.get("content-type"), "image/jpeg");
    assert.equal((await shot.arrayBuffer()).byteLength, 4);
    assert.equal((await tap()).status, 403, "viewing does not allow control");
    allowed = new Set(["screen", "control"]);
    assert.equal((await tap()).status, 200);
    assert.equal(inputs[0].method, "remoteClick");
    const bad = await fetch(base + "/api/input", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ kind: "key", key: "delete-everything" }),
    });
    assert.equal(bad.status, 400);
  } finally {
    await link.close();
  }
});
