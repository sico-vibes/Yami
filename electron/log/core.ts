import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { maskSecrets } from "../mask.ts";

// Yami's logs, written for people and for coding agents alike. Each line is
// one JSON object, in a file per day and channel:
//   LOG  what Yami did: start, modules, slow or failed requests, windows
//   ERR  every error, with its stack
//   DEG  debug detail, only while Settings › Your data › Debug logging is on
//   TRG  triage: one entry per distinct problem, with what led up to it
//   CLT  a collected report (logs/collected/), made when the user asks
// Secrets are masked and the user's home folder is shortened to "~" before
// anything is written. Chat text, transcripts and file contents are never
// logged by the callers; only names, counts and lengths.

export type Channel = "LOG" | "ERR" | "DEG" | "TRG";
export type Entry = {
  t: string;
  ch: Channel;
  area: string;
  msg: string;
  data?: unknown;
};
type Problem = { id: string; count: number; first: string; last: string };

const DAY_FILES_KEPT = 7,
  MAX_FILE_BYTES = 5 * 1024 * 1024,
  RECENT = 200;

export function createLogCore(opts: {
  dir: string;
  home?: string;
  version: string;
  /** Extra facts for triage entries: modules on, windows open. */
  context?: () => Record<string, unknown>;
  /** Whether DEG lines are written; read on every call. */
  debug?: () => boolean;
  now?: () => Date;
}) {
  const now = opts.now || (() => new Date());
  const recent: Entry[] = [];
  const problems = new Map<string, Problem>();
  const sizes = new Map<string, number>();
  const pending = new Map<string, string[]>();
  let flushing: Promise<void> | undefined,
    pruned = "";
  const home = opts.home?.replace(/[\\/]+$/, "");

  /** Masks secrets and the home folder in text, and in any nested value. */
  const clean = (value: unknown, depth = 0): unknown => {
    if (typeof value === "string") {
      let s = maskSecrets(value).text;
      if (home) s = s.split(home).join("~");
      return s.length > 4000 ? s.slice(0, 4000) + "…" : s;
    }
    if (depth > 4 || value === null || typeof value !== "object") return value;
    if (value instanceof Error)
      return clean(
        { name: value.name, message: value.message, stack: value.stack },
        depth,
      );
    if (Array.isArray(value))
      return value.slice(0, 50).map((v) => clean(v, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value).slice(0, 50))
      out[k] = /key|token|secret|password|authorization|cookie/i.test(k)
        ? "[hidden]"
        : clean(v, depth + 1);
    return out;
  };

  const day = (d = now()) => d.toISOString().slice(0, 10);
  const file = (ch: Channel, d = now()) =>
    path.join(opts.dir, `${day(d)}.${ch}`);

  /** Removes day files older than a week, once a day. */
  const prune = () => {
    const today = day();
    if (pruned === today) return;
    pruned = today;
    const cutoff = new Date(now().getTime() - DAY_FILES_KEPT * 86_400_000)
      .toISOString()
      .slice(0, 10);
    try {
      for (const name of fs.readdirSync(opts.dir)) {
        const m = /^(\d{4}-\d{2}-\d{2})\.(LOG|ERR|DEG|TRG)$/.exec(name);
        if (m && m[1] < cutoff)
          fs.rmSync(path.join(opts.dir, name), { force: true });
      }
    } catch {}
  };

  const append = (target: string, line: string) => {
    let size = sizes.get(target);
    if (size === undefined) {
      try {
        size = fs.statSync(target).size;
      } catch {
        size = 0;
      }
    }
    if (size > MAX_FILE_BYTES) return;
    const text =
      size + line.length > MAX_FILE_BYTES
        ? JSON.stringify({
            t: now().toISOString(),
            ch: "LOG",
            area: "log",
            msg: "This file reached 5 MB; later lines today are dropped.",
          }) + "\n"
        : line;
    sizes.set(target, size + (text === line ? line.length : MAX_FILE_BYTES));
    return text;
  };

  // Lines wait per file and are written one file at a time, in order.
  const flush = async () => {
    while (pending.size) {
      const [target, list] = pending.entries().next().value!;
      pending.delete(target);
      await fs.promises.mkdir(opts.dir, { recursive: true }).catch(() => {});
      await fs.promises.appendFile(target, list.join("")).catch(() => {});
    }
    flushing = undefined;
  };

  const write = (entry: Entry, sync = false) => {
    const target = file(entry.ch);
    const line = append(target, JSON.stringify(entry) + "\n");
    if (!line) return;
    if (sync) {
      try {
        fs.mkdirSync(opts.dir, { recursive: true });
        fs.appendFileSync(target, line);
      } catch {}
      return;
    }
    const list = pending.get(target);
    if (list) list.push(line);
    else pending.set(target, [line]);
    flushing ||= Promise.resolve().then(flush);
    prune();
  };

  const entry = (
    ch: Channel,
    area: string,
    msg: string,
    data?: unknown,
  ): Entry => {
    const e: Entry = {
      t: now().toISOString(),
      ch,
      area,
      msg: String(clean(msg)),
    };
    if (data !== undefined) e.data = clean(data);
    return e;
  };
  const remember = (e: Entry) => {
    recent.push(e);
    if (recent.length > RECENT) recent.shift();
  };

  /** A short id for "the same problem": its area, message and first frames. */
  const fingerprint = (area: string, msg: string, stack = "") => {
    const frames = stack
      .split("\n")
      .slice(1, 4)
      .map((l) => l.replace(/:\d+:\d+\)?$/, "").trim())
      .join("|");
    const base = `${area}|${msg.replace(/\d+/g, "#")}|${frames}`;
    return createHash("sha256").update(base).digest("hex").slice(0, 10);
  };

  const api = {
    dir: opts.dir,
    info(area: string, msg: string, data?: unknown) {
      const e = entry("LOG", area, msg, data);
      remember(e);
      write(e);
    },
    debugLog(area: string, msg: string, data?: unknown) {
      if (!opts.debug?.()) return;
      const e = entry("DEG", area, msg, data);
      write(e);
    },
    /**
     * Logs an error, and the first, 10th, 100th… time a problem is seen, a
     * triage entry with the context and the lines that led up to it.
     */
    error(area: string, error: unknown, data?: unknown, sync = false) {
      const err = error instanceof Error ? error : new Error(String(error));
      const e = entry("ERR", area, err.message, {
        ...(data && typeof data === "object"
          ? data
          : data === undefined
            ? {}
            : { detail: data }),
        stack: err.stack,
      });
      remember(e);
      write(e, sync);
      const id = fingerprint(area, err.message, err.stack);
      const p = problems.get(id) || { id, count: 0, first: e.t, last: e.t };
      p.count++;
      p.last = e.t;
      problems.set(id, p);
      if (Math.log10(p.count) % 1 === 0)
        write(
          {
            ...entry("TRG", area, err.message),
            data: clean({
              id,
              count: p.count,
              firstSeen: p.first,
              stack: err.stack,
              detail: data,
              version: opts.version,
              context: opts.context?.(),
              before: recent.slice(-21, -1),
            }),
          },
          sync,
        );
      return id;
    },
    /** Problems seen in this run, most frequent first. */
    problems: () => [...problems.values()].sort((a, b) => b.count - a.count),
    recent: () => recent.slice(),
    /** Waits for queued lines to reach the disk. */
    flush: () => flushing || Promise.resolve(),
    /** Reads the newest entries of a channel across the kept days. */
    read(ch: Channel, limit = 200, since?: string): Entry[] {
      const out: Entry[] = [];
      let names: string[] = [];
      try {
        names = fs
          .readdirSync(opts.dir)
          .filter((n) => n.endsWith("." + ch))
          .sort()
          .reverse();
      } catch {}
      for (const name of names) {
        let lines: string[] = [];
        try {
          lines = fs
            .readFileSync(path.join(opts.dir, name), "utf8")
            .trim()
            .split("\n")
            .reverse();
        } catch {}
        for (const l of lines) {
          try {
            const e = JSON.parse(l) as Entry;
            if (since && e.t < since) return out.reverse();
            out.push(e);
          } catch {}
          if (out.length >= limit) return out.reverse();
        }
      }
      return out.reverse();
    },
    /**
     * A report to attach to a bug or hand to a coding agent: what happened,
     * where, and the evidence, in one Markdown file with JSON blocks.
     */
    collect(extra: {
      settings?: unknown;
      system?: Record<string, unknown>;
      note?: string;
    }) {
      const stamp = now().toISOString().replace(/[:.]/g, "-");
      const target = path.join(
        opts.dir,
        "collected",
        `yami-report-${stamp}.CLT.md`,
      );
      const block = (title: string, value: unknown) =>
        `## ${title}\n\n\`\`\`json\n${JSON.stringify(clean(value), null, 1)}\n\`\`\`\n`;
      const text = [
        `# Yami report ${now().toISOString()}`,
        "",
        "Made by Settings › Your data › Collect logs. Secrets are masked and your home folder is shown as ~. Read it before you share it.",
        "",
        "For coding agents: `problems` groups errors by id (the same id appears in the TRG entries). `errors` and `log` are the newest entries, oldest first, one JSON object each. Settings that look like secrets are hidden.",
        "",
        extra.note
          ? `## What the user said\n\n${String(clean(extra.note))}\n`
          : "",
        block("system", {
          version: opts.version,
          ...extra.system,
          context: opts.context?.(),
        }),
        block("problems", api.problems()),
        block("triage", api.read("TRG", 30)),
        block("errors", api.read("ERR", 150)),
        block("log", api.read("LOG", 300)),
        opts.debug?.() ? block("debug", api.read("DEG", 300)) : "",
        extra.settings ? block("settings", extra.settings) : "",
      ].join("\n");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
      // Keep the ten newest reports.
      try {
        const dir = path.dirname(target);
        const old = fs
          .readdirSync(dir)
          .filter((n) => n.endsWith(".CLT.md"))
          .sort()
          .reverse()
          .slice(10);
        for (const n of old) fs.rmSync(path.join(dir, n), { force: true });
      } catch {}
      return target;
    },
  };
  return api;
}
export type LogCore = ReturnType<typeof createLogCore>;
