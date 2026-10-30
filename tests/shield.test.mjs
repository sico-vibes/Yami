import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Resolver } from "node:dns/promises";
import {
  cleanDomain,
  DomainSet,
  packList,
  packNames,
  parseList,
} from "../electron/tune/shield-lists.ts";
import {
  blockedReply,
  localOnly,
  readQuestion,
  relay,
} from "../electron/tune/shield-dns.ts";
import { NetworkShield } from "../electron/tune/shield.ts";
import { freePort } from "./free-port.mjs";

/** A query for one name, with an EDNS record when size is given. */
function query(name, type = 1, size) {
  const labels = name.split(".").map((l) => [l.length, ...Buffer.from(l)]);
  const head = Buffer.from([
    0x12,
    0x34,
    0x01,
    0x00,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    size ? 1 : 0,
  ]);
  const q = Buffer.from([...labels.flat(), 0, type >> 8, type & 255, 0, 1]);
  const opt = size
    ? Buffer.from([0, 0, 41, size >> 8, size & 255, 0, 0, 0, 0, 0, 0])
    : Buffer.alloc(0);
  return Buffer.concat([head, q, opt]);
}

test("lists parse into exact names, suffixes and exceptions", () => {
  const hosts = parseList(
    "# c\n127.0.0.1 localhost\n0.0.0.0 0.0.0.0\n0.0.0.0 Ads.Example.com # x\n0.0.0.0 bad_name!\n",
    "hosts",
  );
  assert.deepEqual(hosts.exact, ["ads.example.com"]);
  const ab = parseList(
    "! title\n||track.example^\n@@||ok.track.example^|\n||x.example^$important\n||y.example^$badfilter\n||ad-*.example^\n/^re/\n",
    "adblock",
  );
  assert.deepEqual(ab.suffix, ["track.example", "x.example"]);
  assert.deepEqual(ab.allow, ["ok.track.example", "y.example"]);
  assert.equal(ab.skipped, 2);
  assert.equal(
    cleanDomain(" https://Ads.Example.com/path "),
    "ads.example.com",
  );
  assert.equal(cleanDomain("*.example.com"), "example.com");
  assert.equal(cleanDomain("not a domain"), undefined);
  assert.equal(cleanDomain("localhost"), undefined);
});

test("a packed name list finds names and their parents", () => {
  const set = new DomainSet(packNames(["b.com", "a.com", "x.y.org", "a.com"]));
  assert.equal(set.size, 3);
  assert.ok(set.has("a.com") && set.has("b.com") && set.has("x.y.org"));
  assert.ok(!set.has("c.com") && !set.has("y.org") && !set.has("a.co"));
  assert.equal(set.covers("deep.x.y.org"), "x.y.org");
  assert.equal(set.covers("y.org"), undefined);
  assert.equal(new DomainSet(Buffer.alloc(0)).has("a.com"), false);
});

test("queries are read and answered without the upstream", () => {
  const msg = query("Ads.Example.com", 28, 1232);
  const q = readQuestion(msg);
  assert.deepEqual(
    { id: q.id, name: q.name, type: q.type, udpSize: q.udpSize },
    { id: 0x1234, name: "ads.example.com", type: 28, udpSize: 1232 },
  );
  const out = blockedReply(msg, q);
  assert.equal(out.readUInt16BE(0), 0x1234);
  assert.equal(out.readUInt16BE(2) & 0x8000, 0x8000, "a response");
  assert.equal(out.readUInt16BE(6), 1, "one answer");
  assert.equal(out.length, q.end + 12 + 16, "an all-zero IPv6 address");
  assert.equal(readQuestion(out), undefined, "responses are not queries");
  // Too big for the asker's UDP size: truncated, so it retries over TCP.
  const big = Buffer.concat([out, Buffer.alloc(600)]);
  const plain = readQuestion(query("a.example.com"));
  const cut = relay(big, query("a.example.com"), plain, true);
  assert.ok(cut.readUInt16BE(2) & 0x0200, "TC set");
  assert.equal(
    relay(big, query("a.example.com"), plain, false).length,
    big.length,
  );
  assert.ok(localOnly("printer") && localOnly("nas.local"));
  assert.ok(
    localOnly("1.1.168.192.in-addr.arpa") && localOnly("4.3.2.10.in-addr.arpa"),
  );
  assert.ok(!localOnly("example.com") && !localOnly("8.8.8.8.in-addr.arpa"));
});

/** A DNS-over-HTTPS stand-in: A 1.2.3.4 for everything, a long TXT for big. */
function upstream(asked) {
  return async (url, init) => {
    if (String(url).includes("StevenBlack"))
      return new Response(
        "0.0.0.0 ads.example.com\n0.0.0.0 tracker.example.net\n",
        {
          headers: { etag: '"v1"' },
        },
      );
    if (String(url).includes("AdGuardSDNSFilter"))
      return new Response("||adnet.example^\n@@||fine.adnet.example^\n");
    return doh(asked)(url, Buffer.from(init.body));
  };
}

function doh(asked) {
  return async (url, msg) => {
    const q = readQuestion(msg);
    asked.push(q.name);
    const head = Buffer.from(msg.subarray(0, q.end));
    head.writeUInt16BE(0, 0); // DoH asks for id 0; the shield puts it back
    head.writeUInt16BE(0x8180, 2);
    head.writeUInt16BE(1, 6);
    head.writeUInt16BE(0, 10);
    let rdata = Buffer.from([1, 2, 3, 4]);
    if (q.type === 16) {
      const text = Buffer.alloc(200, 120);
      rdata = Buffer.concat(
        [0, 1, 2, 3].map(() => Buffer.concat([Buffer.from([200]), text])),
      );
    }
    const rr = Buffer.alloc(12);
    rr.writeUInt16BE(0xc00c, 0);
    rr.writeUInt16BE(q.type, 2);
    rr.writeUInt16BE(1, 4);
    rr.writeUInt32BE(300, 6);
    rr.writeUInt16BE(rdata.length, 10);
    return Buffer.concat([head, rr, rdata]);
  };
}

test("the shield blocks listed names, forwards the rest and counts", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-shield-"));
  const port = await freePort();
  const asked = [];
  const shield = new NetworkShield({
    dir,
    port,
    hosts: ["127.0.0.1"],
    fetcher: upstream(asked),
    doh: doh(asked),
    pack: packList,
  });
  try {
    let status = await shield.set({ on: true });
    assert.ok(status.running);
    status = await shield.update();
    assert.equal(status.lists.find((l) => l.id === "stevenblack").rules, 2);
    const dns = new Resolver({ timeout: 3000, tries: 1 });
    dns.setServers([`127.0.0.1:${port}`]);
    assert.deepEqual(await dns.resolve4("ads.example.com"), ["0.0.0.0"]);
    assert.deepEqual(await dns.resolve4("www.example.com"), ["1.2.3.4"]);
    // A hosts entry blocks that name only, not the names under it.
    assert.deepEqual(await dns.resolve4("sub.ads.example.com"), ["1.2.3.4"]);
    // Over 512 bytes: truncated over UDP, then asked again over TCP.
    const txt = await dns.resolveTxt("big.example.com");
    assert.equal(txt[0].join("").length, 800);
    await assert.rejects(dns.resolve4("printer"), /ENOTFOUND/);
    // The stricter list blocks a name and everything under it.
    await shield.set({ list: "adguard", enabled: true });
    await shield.update();
    assert.deepEqual(await dns.resolve4("x.adnet.example"), ["0.0.0.0"]);
    assert.deepEqual(await dns.resolve4("fine.adnet.example"), ["1.2.3.4"]);
    // Your own rules win over the lists.
    shield.rule("ads.example.com", "allow");
    assert.deepEqual(await dns.resolve4("ads.example.com"), ["1.2.3.4"]);
    shield.rule("www.example.com", "block");
    assert.deepEqual(await dns.resolve4("img.www.example.com"), ["0.0.0.0"]);
    assert.throws(() => shield.rule("not a domain", "block"), /domain/);
    status = shield.status();
    assert.equal(status.stats.blocked, 3);
    assert.ok(status.stats.queries >= 9);
    assert.equal(status.stats.recent[0].name, "img.www.example.com");
    assert.equal(status.stats.recent[0].by, "your list");
    assert.ok(!asked.includes("x.adnet.example") && !asked.includes("printer"));
    // Off closes the port; the choice and the counts are kept.
    status = await shield.set({ on: false });
    assert.equal(status.running, false);
    await assert.rejects(dns.resolve4("www.example.com"));
    const again = new NetworkShield({ dir, port, hosts: ["127.0.0.1"] });
    assert.equal(again.status().stats.blocked, 3);
    assert.deepEqual(again.status().allow, ["ads.example.com"]);
    assert.equal(again.status().on, false);
  } finally {
    shield.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
