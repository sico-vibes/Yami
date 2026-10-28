import test from "node:test";
import assert from "node:assert/strict";
import { maskSecrets } from "../electron/mask.ts";

test("credentials are hidden before text reaches a provider", () => {
  const input = [
    "my key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345",
    "github: ghp_0123456789abcdefghijklmnopqrstuvwxyzAB",
    "google AIzaSyA1234567890abcdefghijklmnopqrstuv",
    "aws AKIAABCDEFGHIJKLMNOP",
    "password = hunter2secret",
    'API_KEY="abcd1234efgh"',
    "card 4111 1111 1111 1111 please",
    "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----",
  ].join("\n");
  const { text, found } = maskSecrets(input);
  for (const secret of [
    "sk-ant-api03",
    "ghp_0123",
    "AIzaSy",
    "AKIAABCD",
    "hunter2",
    "abcd1234efgh",
    "4111 1111",
    "MIIE",
  ])
    assert.ok(!text.includes(secret), secret + " leaked:\n" + text);
  assert.match(
    text,
    /password = \[hidden password\]/,
    "the sentence still reads",
  );
  assert.deepEqual(
    found.sort(),
    [
      "Anthropic key",
      "AWS key",
      "GitHub token",
      "Google API key",
      "card number",
      "password",
      "private key",
    ].sort(),
  );
});

test("ordinary text and numbers are left alone", () => {
  const plain =
    "Order 1234567890123 shipped; call 555-0100; build 20261028 passed; token budget is 4096.";
  assert.deepEqual(maskSecrets(plain), { text: plain, found: [] });
  assert.equal(maskSecrets("sk-short").text, "sk-short");
});
