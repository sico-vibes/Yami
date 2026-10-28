import test from "node:test";
import assert from "node:assert/strict";
import { sshHosts } from "../electron/workbench/ssh-hosts.ts";

test("SSH config hosts list plain aliases only", () => {
  const config = [
    "Host *",
    "  ServerAliveInterval 30",
    "Host vps vps-backup",
    "  HostName 203.0.113.7",
    "  User ana",
    "host pi.local",
    "Host *.internal !gateway",
    "Host bad;rm",
    "Host vps",
    "Match host other",
  ].join("\r\n");
  assert.deepEqual(sshHosts(config), ["vps", "vps-backup", "pi.local"]);
  assert.deepEqual(sshHosts(""), []);
});
