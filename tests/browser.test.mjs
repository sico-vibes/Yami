import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { newTab, resolveInput, webOnly } from "../src/browser-rules.ts";
import {
  readChromiumBookmarks,
  Vault,
  browserProfiles,
} from "../electron/browser/vault.ts";

test("the address bar loads web pages, bangs and searches, nothing else", () => {
  assert.equal(resolveInput(""), newTab);
  assert.equal(resolveInput("example.com"), "https://example.com/");
  assert.equal(resolveInput("localhost:5173/app"), "http://localhost:5173/app");
  assert.equal(
    resolveInput("https://news.ycombinator.com"),
    "https://news.ycombinator.com/",
  );
  assert.equal(
    resolveInput("!w electron"),
    "https://en.wikipedia.org/w/index.php?search=electron",
  );
  assert.equal(
    resolveInput("rust lifetimes !gh"),
    "https://github.com/search?q=rust%20lifetimes",
  );
  assert.match(
    resolveInput("how do tabs work"),
    /^https:\/\/duckduckgo\.com\/\?q=how%20do%20tabs%20work$/,
  );
  assert.match(
    resolveInput("javascript:alert(1)"),
    /^https:\/\/duckduckgo\.com\//,
    "becomes a search",
  );
  assert.match(
    resolveInput("file:///C:/Windows/win.ini"),
    /^https:\/\/duckduckgo\.com\//,
  );
  assert.equal(webOnly("https://user:pw@example.com"), false);
  assert.equal(webOnly("chrome://settings"), false);
  assert.equal(webOnly("http://example.com"), true);
});

test("Chromium bookmarks import with folders, web links only", () => {
  const json = JSON.stringify({
    roots: {
      bookmark_bar: {
        type: "folder",
        name: "Bookmarks bar",
        children: [
          { type: "url", name: "Yami", url: "https://example.com/yami" },
          {
            type: "folder",
            name: "Dev",
            children: [
              {
                type: "url",
                name: "MDN",
                url: "https://developer.mozilla.org/",
              },
            ],
          },
          { type: "url", name: "Bad", url: "javascript:alert(1)" },
        ],
      },
      other: {
        type: "folder",
        children: [{ type: "url", name: "Files", url: "file:///C:/" }],
      },
    },
  });
  assert.deepEqual(readChromiumBookmarks(json, "Edge"), [
    {
      title: "Yami",
      url: "https://example.com/yami",
      folder: "",
      from: "Edge",
    },
    {
      title: "MDN",
      url: "https://developer.mozilla.org/",
      folder: "Dev",
      from: "Edge",
    },
  ]);
});

test("the vault stays encrypted on disk and merges imports without duplicates", () => {
  const local = fs.mkdtempSync(path.join(os.tmpdir(), "yami-vault-local-"));
  const edge = browserProfiles(local).find((b) => b.id === "edge").file;
  fs.mkdirSync(path.dirname(edge), { recursive: true });
  fs.writeFileSync(
    edge,
    JSON.stringify({
      roots: {
        bar: {
          type: "folder",
          children: [{ type: "url", name: "A", url: "https://a.example/" }],
        },
      },
    }),
  );
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "yami-vault-")),
    "vault.bin",
  );
  // A stand-in for DPAPI: reversible, but not plain JSON on disk.
  const crypto = {
    available: () => true,
    encrypt: (t) => Buffer.from(t).map((b) => b ^ 0x5a),
    decrypt: (d) => Buffer.from(d.map((b) => b ^ 0x5a)).toString(),
  };
  const vault = new Vault(file, crypto);
  assert.deepEqual(
    vault
      .sources(local)
      .filter((s) => s.found)
      .map((s) => s.id),
    ["edge"],
  );
  assert.deepEqual(vault.import("edge", local), { added: 1, total: 1 });
  assert.deepEqual(
    vault.import("edge", local),
    { added: 0, total: 1 },
    "no duplicates",
  );
  assert.ok(
    !fs.readFileSync(file, "utf8").includes("a.example"),
    "encrypted on disk",
  );
  assert.equal(new Vault(file, crypto).list()[0].url, "https://a.example/");
  assert.throws(() => vault.import("chrome", local), /no bookmarks file/);
  assert.throws(() => vault.import("nope", local), /Choose a browser/);
  assert.equal(vault.remove("https://a.example/").length, 0);
  vault.clear();
  assert.equal(fs.existsSync(file), false);
  const locked = new Vault(file, { ...crypto, available: () => false });
  assert.throws(
    () => locked.import("edge", local),
    /encryption is unavailable/,
  );
});
