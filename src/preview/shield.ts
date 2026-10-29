import type { ShieldStatus } from "../tune-types";

// Browser-preview stand-in for Tune's network shield: made-up counts, and
// nothing listens or downloads.
const hour = 3_600_000,
  now = Date.now();
const status: ShieldStatus = {
  on: true,
  running: true,
  updating: false,
  upstream: "quad9",
  lists: [
    {
      id: "stevenblack",
      name: "StevenBlack hosts",
      detail: "Ads and malware, merged from several curated lists",
      licence: "MIT",
      enabled: true,
      updated: now - 2 * 24 * hour,
      rules: 76148,
    },
    {
      id: "adguard",
      name: "AdGuard DNS filter",
      detail: "Ads, trackers and analytics; larger and stricter",
      licence: "GPL-3.0, downloaded only",
      enabled: false,
      updated: 0,
      rules: 0,
    },
  ],
  allow: ["cdn.example.org"],
  block: [],
  stats: {
    since: now - 3 * 24 * hour,
    queries: 18452,
    blocked: 2391,
    hours: Array.from({ length: 24 }, (_, i) => ({
      at: Math.floor(now / hour) * hour - (23 - i) * hour,
      queries: 300 + ((i * 37) % 200),
      blocked: 30 + ((i * 13) % 40),
    })),
    topBlocked: [
      ["ads.example.net", 512],
      ["telemetry.example.com", 301],
      ["pixel.example.io", 188],
    ],
    topAsked: [
      ["www.example.com", 1904],
      ["api.example.dev", 877],
      ["fonts.example.org", 402],
    ],
    recent: [
      {
        at: now - 4000,
        name: "ads.example.net",
        type: "A",
        blocked: true,
        by: "stevenblack",
      },
      {
        at: now - 9000,
        name: "www.example.com",
        type: "HTTPS",
        blocked: false,
      },
      {
        at: now - 15000,
        name: "api.example.dev",
        type: "AAAA",
        blocked: false,
      },
    ],
  },
};

export function previewShield(method: string, a: any = {}): ShieldStatus {
  if (method === "tune.shield.set") {
    if (a.on !== undefined) status.on = status.running = !!a.on;
    if (a.upstream) status.upstream = String(a.upstream);
    const list = status.lists.find((l) => l.id === a.list);
    if (list) list.enabled = !!a.enabled;
  } else if (method === "tune.shield.rule") {
    const d = String(a.domain || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d))
      throw new Error("Type a domain such as ads.example.com.");
    status.allow = status.allow.filter((x) => x !== d);
    status.block = status.block.filter((x) => x !== d);
    if (a.kind === "allow") status.allow.push(d);
    if (a.kind === "block") status.block.push(d);
  } else if (method === "tune.shield.update")
    throw new Error("Preview only — nothing was downloaded.");
  else if (method === "tune.shield.reset")
    throw new Error("Preview only — the counts were kept.");
  return structuredClone(status);
}
