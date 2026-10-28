import test from "node:test";
import assert from "node:assert/strict";
import { elevatedArgs, profileOf, psQuote } from "../electron/tune/dns.ts";
import { dnsProfiles } from "../src/tune-types.ts";

test("server lists map to known profiles, anything else is custom", () => {
  assert.equal(profileOf(["1.1.1.3", "1.0.0.3"]), "cloudflareFamily");
  assert.equal(profileOf(["9.9.9.9", "149.112.112.112"]), "quad9");
  assert.equal(profileOf(["192.168.1.1"]), "custom");
  assert.equal(profileOf([]), "custom");
  assert.equal(new Set(dnsProfiles.map((p) => p.id)).size, dnsProfiles.length);
  for (const p of dnsProfiles)
    for (const s of p.servers) assert.match(s, /^\d{1,3}(\.\d{1,3}){3}$/);
});

test("the elevated command quotes the script path and passes only a number and an id", () => {
  assert.equal(psQuote("D:\\Basem's\\Dns.ps1"), "'D:\\Basem''s\\Dns.ps1'");
  const args = elevatedArgs("D:\\Basem's Coding\\Dns.ps1", 7, "quad9");
  assert.deepEqual(args.slice(0, 3), [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
  ]);
  const command = args[3];
  assert.match(command, /-Verb RunAs -Wait -PassThru/);
  assert.ok(command.includes(`'"D:\\Basem''s Coding\\Dns.ps1"'`), command);
  assert.ok(command.includes("'-Index','7','-Profile','quad9'"), command);
  assert.match(command, /exit \$p\.ExitCode$/);
});
