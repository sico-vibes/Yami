// Block lists for the network shield. A list is kept as one sorted text
// file of names and searched in place, so a quarter of a million names cost
// a few megabytes instead of the twenty a JavaScript Set would.

export const shieldLists = [
  {
    id: "stevenblack",
    name: "StevenBlack hosts",
    detail: "Ads and malware, merged from several curated lists",
    licence: "MIT",
    url: "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts",
    format: "hosts",
  },
  {
    id: "adguard",
    name: "AdGuard DNS filter",
    detail: "Ads, trackers and analytics; larger and stricter",
    licence: "GPL-3.0, downloaded only",
    url: "https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt",
    format: "adblock",
  },
] as const;
export type ShieldListId = (typeof shieldLists)[number]["id"];

const name =
  /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?)+$/;
/** A domain a person typed, cleaned, or undefined when it is not one. */
export function cleanDomain(value: unknown) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/:?#].*$/, "")
    .replace(/^\*\./, "")
    .replace(/\.$/, "");
  return text.length <= 253 && name.test(text) ? text : undefined;
}

export type ParsedList = {
  /** Blocks the name only (hosts files). */
  exact: string[];
  /** Blocks the name and everything under it (||name^). */
  suffix: string[];
  /** Exceptions (@@||name^), which win over every block. */
  allow: string[];
  /** Rules Yami cannot apply: wildcards, regular expressions, modifiers. */
  skipped: number;
};

const unblockable = new Set([
  "0.0.0.0",
  "localhost",
  "localhost.localdomain",
  "local",
  "broadcasthost",
  "ip6-localhost",
  "ip6-loopback",
]);

export function parseList(
  text: string,
  format: "hosts" | "adblock",
): ParsedList {
  const out: ParsedList = { exact: [], suffix: [], allow: [], skipped: 0 };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line[0] === "#" || line[0] === "!") continue;
    if (format === "hosts") {
      const m = /^(0\.0\.0\.0|127\.0\.0\.1|::1?)\s+([^\s#]+)/.exec(line);
      const domain = m && m[2].toLowerCase();
      if (domain && !unblockable.has(domain) && name.test(domain))
        out.exact.push(domain);
      continue;
    }
    const m = /^(@@)?\|\|?([a-z0-9._-]+)\^\|?(\$(important|badfilter))?$/.exec(
      line.toLowerCase(),
    );
    if (!m || !name.test(m[2])) {
      out.skipped++;
      continue;
    }
    // $badfilter cancels a rule elsewhere; treating it as an exception keeps
    // the name working, which is the safe side.
    if (m[1] || m[4] === "badfilter") out.allow.push(m[2]);
    else out.suffix.push(m[2]);
  }
  return out;
}

/** Sorted, unique names joined by newlines: the file a DomainSet reads. */
export function packNames(names: Iterable<string>) {
  return Buffer.from([...new Set(names)].sort().join("\n"), "latin1");
}

/** A sorted list of names searched in place with binary search. */
export class DomainSet {
  private starts: Uint32Array;
  constructor(private data: Buffer) {
    let count = data.length ? 1 : 0;
    for (let i = 0; i < data.length; i++) if (data[i] === 10) count++;
    this.starts = new Uint32Array(count + 1);
    let n = 0;
    if (data.length) this.starts[n++] = 0;
    for (let i = 0; i < data.length; i++)
      if (data[i] === 10) this.starts[n++] = i + 1;
    this.starts[n] = data.length + 1;
  }
  get size() {
    return this.starts.length - 1;
  }
  has(domain: string) {
    const key = Buffer.from(domain, "latin1");
    let lo = 0,
      hi = this.size - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = key.compare(
        this.data,
        this.starts[mid],
        this.starts[mid + 1] - 1,
      );
      if (c === 0) return true;
      if (c < 0) hi = mid - 1;
      else lo = mid + 1;
    }
    return false;
  }
  /** The name itself or the closest parent that is in the set. */
  covers(domain: string) {
    for (let at = 0; at !== -1;) {
      const part = domain.slice(at);
      if (!part.includes(".")) return undefined;
      if (this.has(part)) return part;
      const dot = domain.indexOf(".", at);
      at = dot === -1 ? -1 : dot + 1;
    }
    return undefined;
  }
}

export type PackCounts = { rules: number; skipped: number };

/** Parses a downloaded list and writes its three name files next to it. */
export async function packList(
  source: string,
  format: "hosts" | "adblock",
  base: string,
): Promise<PackCounts> {
  const fs = await import("node:fs/promises");
  const parsed = parseList(await fs.readFile(source, "utf8"), format);
  await fs.writeFile(base + ".exact", packNames(parsed.exact));
  await fs.writeFile(base + ".suffix", packNames(parsed.suffix));
  await fs.writeFile(base + ".allow", packNames(parsed.allow));
  return {
    rules: parsed.exact.length + parsed.suffix.length,
    skipped: parsed.skipped,
  };
}
