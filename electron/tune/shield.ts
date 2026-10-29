import dgram from "node:dgram";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { execFile } from "node:child_process";
import { shieldUpstreams, type ShieldStatus } from "../../src/tune-types.ts";
import {
  blockedReply,
  failReply,
  localOnly,
  missingReply,
  readQuestion,
  relay,
  typeName,
  type Question,
} from "./shield-dns.ts";
import {
  cleanDomain,
  DomainSet,
  shieldLists,
  type PackCounts,
  type ShieldListId,
} from "./shield-lists.ts";
import { createDoh, type Doh } from "./shield-doh.ts";

// Tune's network shield: a DNS resolver on this PC (127.0.0.1 and ::1, port
// 53) that answers blocked names itself and sends the rest to the chosen
// resolver over DNS over HTTPS. It runs only while turned on, needs no
// timer when idle, and keeps counts, not a history, on disk.

type Config = {
  on: boolean;
  upstream: string;
  lists: Partial<Record<ShieldListId, boolean>>;
  allow: string[];
  block: string[];
};
type Stats = {
  since: number;
  queries: number;
  blocked: number;
  hours: { at: number; queries: number; blocked: number }[];
  topBlocked: Record<string, number>;
  topAsked: Record<string, number>;
};
type Meta = Partial<
  Record<
    ShieldListId,
    { updated: number; rules: number; etag?: string; modified?: string }
  >
>;
type Loaded = { exact: DomainSet; suffix: DomainSet; allow: DomainSet };

const HOUR = 3_600_000;
const STALE_AFTER = 7 * 24 * HOUR;
const MAX_LIST = 16 * 1024 * 1024;
const MAX_INFLIGHT = 256;
const freshStats = (): Stats => ({
  since: Date.now(),
  queries: 0,
  blocked: 0,
  hours: [],
  topBlocked: {},
  topAsked: {},
});

export type ShieldOptions = {
  dir: string;
  port?: number;
  hosts?: string[];
  /** Downloads the block lists. */
  fetcher?: typeof fetch;
  /** Asks the resolver over DNS over HTTPS; HTTP/2 unless a test passes one. */
  doh?: Doh;
  /** Parses a downloaded list; a child process unless a test passes one. */
  pack?: (
    source: string,
    format: "hosts" | "adblock",
    base: string,
  ) => Promise<PackCounts>;
};

/** Whether the user left the shield on, read without building it. */
export function shieldWanted(dir: string) {
  try {
    return (
      JSON.parse(fs.readFileSync(path.join(dir, "shield.json"), "utf8")).on ===
      true
    );
  } catch {
    return false;
  }
}

export class NetworkShield {
  private config: Config;
  private stats: Stats;
  private recent: ShieldStatus["stats"]["recent"] = [];
  private loaded = new Map<ShieldListId, Loaded>();
  private sockets: dgram.Socket[] = [];
  private servers: net.Server[] = [];
  private inflight = 0;
  private error = "";
  private updating?: Promise<ShieldStatus>;
  private saveTimer?: NodeJS.Timeout;
  private checked = 0;
  /** The user's own rules as sets; rebuilt after a change. */
  private mine?: { allow: Set<string>; block: Set<string> };
  private port: number;
  private hosts: string[];
  private fetcher: typeof fetch;
  private doh: Doh & { close?(): void };
  private pack: NonNullable<ShieldOptions["pack"]>;

  constructor(private options: ShieldOptions) {
    this.port = options.port ?? 53;
    this.hosts = options.hosts ?? ["127.0.0.1", "::1"];
    this.fetcher = options.fetcher ?? fetch;
    this.doh = options.doh ?? createDoh();
    this.pack = options.pack ?? inChild;
    this.config = {
      on: false,
      upstream: "quad9",
      lists: { stevenblack: true },
      allow: [],
      block: [],
      ...this.read("shield.json"),
    };
    this.stats = { ...freshStats(), ...this.read("shield-stats.json") };
  }

  private file = (name: string) => path.join(this.options.dir, name);
  private read(name: string) {
    try {
      return JSON.parse(fs.readFileSync(this.file(name), "utf8"));
    } catch {
      return {};
    }
  }
  private write(name: string, value: unknown) {
    fs.mkdirSync(this.options.dir, { recursive: true });
    fs.writeFileSync(this.file(name + ".tmp"), JSON.stringify(value));
    fs.renameSync(this.file(name + ".tmp"), this.file(name));
  }
  private meta(): Meta {
    return this.read("shield/lists.json");
  }
  private enabledLists() {
    return shieldLists.filter((l) => this.config.lists[l.id]);
  }

  get running() {
    return this.sockets.length > 0;
  }

  /** Starts answering when the user had it on. */
  async resume() {
    if (this.config.on) await this.start().catch(() => {});
  }

  private async start() {
    if (this.running) return;
    this.error = "";
    this.loadLists();
    try {
      for (const host of this.hosts) {
        try {
          await this.listen(host);
        } catch (error) {
          // IPv6 can be switched off on a PC; IPv4 is what matters.
          if (host === "127.0.0.1") throw error;
        }
      }
    } catch (error) {
      this.close();
      const code = (error as NodeJS.ErrnoException).code;
      this.error =
        code === "EADDRINUSE"
          ? "Another program already answers DNS on this PC (port 53), so the shield cannot start."
          : code === "EACCES"
            ? "Windows did not let Yami use port 53."
            : (error as Error).message;
      throw new Error(this.error);
    }
    if (this.enabledLists().some((l) => !this.loaded.has(l.id)))
      void this.update();
    else this.refreshIfStale();
  }

  private listen(host: string) {
    return new Promise<void>((resolve, reject) => {
      const udp = dgram.createSocket(host.includes(":") ? "udp6" : "udp4");
      udp.once("error", reject);
      udp.on("message", (msg, from) => {
        void this.answer(msg, true).then((out) => {
          if (out && this.sockets.includes(udp))
            udp.send(out, from.port, from.address);
        });
      });
      udp.bind(this.port, host, () => {
        udp.off("error", reject);
        udp.on("error", () => {});
        const tcp = net.createServer((conn) => this.stream(conn));
        tcp.once("error", (error) => {
          udp.close();
          reject(error);
        });
        tcp.listen(this.port, host, () => {
          tcp.on("error", () => {});
          this.sockets.push(udp);
          this.servers.push(tcp);
          resolve();
        });
      });
    });
  }

  /** DNS over TCP: each message has a two-byte length in front. */
  private stream(conn: net.Socket) {
    let buffer: Buffer = Buffer.alloc(0);
    conn.setTimeout(10_000, () => conn.destroy());
    conn.on("error", () => {});
    conn.on("data", (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      if (buffer.length > 70_000) return conn.destroy();
      while (buffer.length >= 2) {
        const size = buffer.readUInt16BE(0);
        if (buffer.length < 2 + size) break;
        const msg = buffer.subarray(2, 2 + size);
        buffer = buffer.subarray(2 + size);
        void this.answer(msg, false).then((out) => {
          if (!out || conn.destroyed) return;
          const head = Buffer.alloc(2);
          head.writeUInt16BE(out.length);
          conn.write(Buffer.concat([head, out]));
        });
      }
    });
  }

  private close() {
    this.doh.close?.();
    for (const s of this.sockets) s.close();
    for (const s of this.servers) s.close();
    this.sockets = [];
    this.servers = [];
  }

  stop() {
    this.close();
    this.loaded.clear();
    this.flush();
  }

  private loadLists() {
    this.loaded.clear();
    for (const list of this.enabledLists()) {
      const base = this.file(path.join("shield", list.id));
      try {
        this.loaded.set(list.id, {
          exact: new DomainSet(fs.readFileSync(base + ".exact")),
          suffix: new DomainSet(fs.readFileSync(base + ".suffix")),
          allow: new DomainSet(fs.readFileSync(base + ".allow")),
        });
      } catch {}
    }
  }

  /** Which rule blocks a name: a list id, "your list", or undefined. */
  blockedBy(name: string) {
    const parents = (set: Set<string>) => {
      for (let at = 0; ;) {
        if (set.has(name.slice(at))) return true;
        const dot = name.indexOf(".", at);
        if (dot === -1) return false;
        at = dot + 1;
      }
    };
    this.mine ||= {
      allow: new Set(this.config.allow),
      block: new Set(this.config.block),
    };
    if (parents(this.mine.allow)) return undefined;
    if (parents(this.mine.block)) return "your list";
    const lists = [...this.loaded];
    if (lists.some(([, l]) => l.allow.covers(name))) return undefined;
    for (const [id, l] of lists)
      if (l.exact.has(name) || l.suffix.covers(name)) return id;
    return undefined;
  }

  /** The reply to one DNS message, or undefined to stay silent. */
  async answer(msg: Buffer, udp: boolean): Promise<Buffer | undefined> {
    const q = readQuestion(msg);
    if (!q) return undefined;
    if (localOnly(q.name)) return missingReply(msg, q);
    const by = this.blockedBy(q.name);
    this.count(q, by);
    if (by) return blockedReply(msg, q);
    if (this.inflight >= MAX_INFLIGHT) return failReply(msg, q);
    this.inflight++;
    try {
      const upstream =
        shieldUpstreams.find((u) => u.id === this.config.upstream) ||
        shieldUpstreams[0];
      const answer = await this.doh(upstream.url, msg);
      if (answer.length < 12) throw new Error("short answer");
      return relay(answer, msg, q, udp);
    } catch {
      return failReply(msg, q);
    } finally {
      this.inflight--;
    }
  }

  private count(q: Question, by: string | undefined) {
    const now = Date.now(),
      hour = Math.floor(now / HOUR) * HOUR,
      s = this.stats;
    s.queries++;
    if (by) s.blocked++;
    let last = s.hours[s.hours.length - 1];
    if (!last || last.at !== hour) {
      last = { at: hour, queries: 0, blocked: 0 };
      s.hours.push(last);
      s.hours = s.hours.filter((h) => h.at > now - 24 * HOUR);
    }
    last.queries++;
    if (by) last.blocked++;
    const top = by ? s.topBlocked : s.topAsked;
    top[q.name] = (top[q.name] || 0) + 1;
    if (Object.keys(top).length > 2000) {
      const keep = Object.entries(top)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1000);
      if (by) s.topBlocked = Object.fromEntries(keep);
      else s.topAsked = Object.fromEntries(keep);
    }
    this.recent.unshift({
      at: now,
      name: q.name,
      type: typeName[q.type] || String(q.type),
      blocked: !!by,
      ...(by && { by }),
    });
    if (this.recent.length > 100) this.recent.length = 100;
    // Saved a minute after lookups, so a quiet PC writes nothing.
    this.saveTimer ||= setTimeout(() => this.flush(), 60_000);
    this.saveTimer.unref?.();
    if (now - this.checked > 24 * HOUR) {
      this.checked = now;
      this.refreshIfStale();
    }
  }

  private flush() {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    try {
      this.write("shield-stats.json", this.stats);
    } catch {}
  }

  private refreshIfStale(now = Date.now()) {
    const meta = this.meta();
    if (
      this.enabledLists().some(
        (l) => now - (meta[l.id]?.updated || 0) > STALE_AFTER,
      )
    )
      void this.update();
  }

  /** Downloads the turned-on lists (sending ETag / Last-Modified). */
  update(): Promise<ShieldStatus> {
    this.updating ||= (async () => {
      try {
        const dir = this.file("shield");
        await fs.promises.mkdir(dir, { recursive: true });
        const meta = this.meta();
        for (const list of this.enabledLists()) {
          const saved = meta[list.id];
          const target = path.join(dir, list.id + ".txt");
          const base = path.join(dir, list.id);
          const have = fs.existsSync(base + ".exact");
          const headers: Record<string, string> = {};
          if (have && saved?.etag) headers["If-None-Match"] = saved.etag;
          if (have && saved?.modified)
            headers["If-Modified-Since"] = saved.modified;
          const response = await this.fetcher(list.url, {
            headers,
            signal: AbortSignal.timeout(60_000),
          });
          if (response.status === 304) {
            meta[list.id] = { ...saved!, updated: Date.now() };
            continue;
          }
          if (!response.ok)
            throw new Error(`${list.name} answered ${response.status}.`);
          await saveBody(response, target, MAX_LIST, list.name);
          const counts = await this.pack(target, list.format, base);
          await fs.promises.rm(target, { force: true });
          if (!counts.rules)
            throw new Error(`${list.name} did not look like a block list.`);
          meta[list.id] = {
            updated: Date.now(),
            rules: counts.rules,
            etag: response.headers.get("etag") || undefined,
            modified: response.headers.get("last-modified") || undefined,
          };
        }
        this.write("shield/lists.json", meta);
        this.error = "";
        if (this.running) this.loadLists();
      } catch (error) {
        this.error =
          (error as Error).name === "TimeoutError"
            ? "The block lists took too long to download."
            : (error as Error).message;
      } finally {
        this.updating = undefined;
      }
      return this.status();
    })();
    return this.updating;
  }

  status(): ShieldStatus {
    const meta = this.meta(),
      top = (o: Record<string, number>) =>
        Object.entries(o)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
    return {
      on: this.config.on,
      running: this.running,
      ...(this.error && { error: this.error }),
      updating: !!this.updating,
      upstream: this.config.upstream,
      lists: shieldLists.map((l) => ({
        id: l.id,
        name: l.name,
        detail: l.detail,
        licence: l.licence,
        enabled: !!this.config.lists[l.id],
        updated: meta[l.id]?.updated || 0,
        rules: meta[l.id]?.rules || 0,
      })),
      allow: [...this.config.allow],
      block: [...this.config.block],
      stats: {
        since: this.stats.since,
        queries: this.stats.queries,
        blocked: this.stats.blocked,
        hours: this.stats.hours.filter((h) => h.at > Date.now() - 24 * HOUR),
        topBlocked: top(this.stats.topBlocked),
        topAsked: top(this.stats.topAsked),
        recent: this.recent.slice(0, 50),
      },
    };
  }

  private save() {
    this.mine = undefined;
    this.write("shield.json", this.config);
  }

  async set(a: {
    on?: unknown;
    upstream?: unknown;
    list?: unknown;
    enabled?: unknown;
  }) {
    if (a.upstream !== undefined) {
      if (!shieldUpstreams.some((u) => u.id === a.upstream))
        throw new Error("Choose a resolver.");
      this.config.upstream = String(a.upstream);
    }
    if (a.list !== undefined) {
      const list = shieldLists.find((l) => l.id === a.list);
      if (!list) throw new Error("Unknown block list.");
      this.config.lists[list.id] = a.enabled === true;
      if (this.running) {
        this.loadLists();
        if (a.enabled === true && !this.loaded.has(list.id)) void this.update();
      }
    }
    if (a.on !== undefined) this.config.on = a.on === true;
    this.save();
    if (this.config.on) await this.start().catch(() => {});
    else if (this.running) this.stop();
    return this.status();
  }

  /** Always allow, always block, or back to the lists for one domain. */
  rule(domain: unknown, kind: unknown) {
    const name = cleanDomain(domain);
    if (!name) throw new Error("Type a domain such as ads.example.com.");
    if (!["allow", "block", "none"].includes(String(kind)))
      throw new Error("Unknown rule.");
    this.config.allow = this.config.allow.filter((d) => d !== name);
    this.config.block = this.config.block.filter((d) => d !== name);
    if (kind === "allow") this.config.allow.push(name);
    if (kind === "block") this.config.block.push(name);
    this.save();
    return this.status();
  }

  resetStats() {
    this.stats = freshStats();
    this.recent = [];
    this.flush();
    return this.status();
  }

  /** Requests from the page under tune.shield. */
  request(method: string, a: any = {}) {
    if (method === "tune.shield") return this.status();
    if (method === "tune.shield.set") return this.set(a);
    if (method === "tune.shield.update") return this.update();
    if (method === "tune.shield.rule") return this.rule(a.domain, a.kind);
    if (method === "tune.shield.reset") return this.resetStats();
    throw new Error("Unknown shield request.");
  }
}

/** Streams a download to a file, so the list never sits in memory whole. */
async function saveBody(
  response: Response,
  target: string,
  limit: number,
  name: string,
) {
  const out = fs.createWriteStream(target);
  let size = 0;
  try {
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > limit) throw new Error(`${name} is larger than expected.`);
      if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
}

/** Runs shield-build.cjs (bundled next to main.cjs) as its own process. */
function inChild(source: string, format: string, base: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
  delete env.NODE_OPTIONS;
  return new Promise<PackCounts>((resolve, reject) => {
    execFile(
      process.execPath,
      [
        path.join(__dirname, "shield-build.cjs"),
        JSON.stringify([source, format, base]),
      ],
      { env, windowsHide: true, timeout: 120_000 },
      (error, stdout, stderr) => {
        if (error)
          return reject(
            new Error(
              String(stderr).trim() || "The block list could not be read.",
            ),
          );
        try {
          resolve(JSON.parse(String(stdout)));
        } catch {
          reject(new Error("The block list could not be read."));
        }
      },
    );
  });
}
