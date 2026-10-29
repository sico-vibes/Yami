import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  fetchPart,
  freeName,
  probe,
  split,
  type Fetcher,
  type Job,
} from "./engine.ts";

// The download list: a queue that runs up to three files at once, each in
// up to eight parts. Jobs live in downloads.json, so paused and unfinished
// downloads come back after a restart (as paused). A timer runs only while
// something downloads, to report speed twice a second.

type Settings = { connections: number; active: number; folder: string };

export class DownloadManager {
  private jobs: Job[] = [];
  private running = new Map<string, AbortController>();
  private tick?: NodeJS.Timeout;
  private window = new Map<string, number>();
  private saveSoon?: NodeJS.Timeout;
  settings: Settings;

  constructor(
    private file: string,
    defaultFolder: string,
    private publish: (jobs: Job[]) => void,
    private fetcher: Fetcher = (url, init) => fetch(url, init),
  ) {
    let saved: { jobs?: Job[]; settings?: Partial<Settings> } = {};
    try {
      saved = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {}
    this.settings = {
      connections: 4,
      active: 3,
      folder: defaultFolder,
      ...saved.settings,
    };
    // Anything running when Yami closed comes back paused.
    this.jobs = (saved.jobs || []).map((j) =>
      j.state === "downloading" || j.state === "queued"
        ? { ...j, state: "paused", speed: 0 }
        : { ...j, speed: 0 },
    );
  }

  list() {
    return { jobs: this.jobs, settings: this.settings };
  }

  private save(now = false) {
    const write = () => {
      this.saveSoon = undefined;
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(
        this.file + ".tmp",
        JSON.stringify({
          jobs: this.jobs.slice(0, 200),
          settings: this.settings,
        }),
      );
      fs.renameSync(this.file + ".tmp", this.file);
    };
    if (now) {
      clearTimeout(this.saveSoon);
      write();
    } else this.saveSoon ||= setTimeout(write, 2000);
  }

  private changed() {
    this.publish(this.jobs);
    this.save();
  }

  /** Adds a download; `fetcher` carries a browser's cookies when given. */
  add(
    url: unknown,
    opts: { name?: string; folder?: string; fetcher?: Fetcher } = {},
  ) {
    const address = String(url || "").trim();
    let parsed: URL;
    try {
      parsed = new URL(address);
    } catch {
      throw new Error("Paste a link that starts with http:// or https://.");
    }
    if (
      !/^https?:$/.test(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error("Paste a link that starts with http:// or https://.");
    const job: Job = {
      id: randomUUID(),
      url: address,
      name: opts.name || "",
      folder: opts.folder || this.settings.folder,
      size: 0,
      received: 0,
      state: "queued",
      parts: [],
      speed: 0,
      added: Date.now(),
    };
    if (opts.fetcher) this.fetchers.set(job.id, opts.fetcher);
    this.jobs.unshift(job);
    this.changed();
    this.pump();
    return job;
  }

  private fetchers = new Map<string, Fetcher>();

  private pump() {
    const active = this.jobs.filter((j) => j.state === "downloading").length;
    const next = this.jobs
      .filter((j) => j.state === "queued")
      .reverse()
      .slice(0, Math.max(0, this.settings.active - active));
    for (const job of next) void this.run(job);
  }

  private async run(job: Job) {
    const abort = new AbortController();
    this.running.set(job.id, abort);
    job.state = "downloading";
    job.error = undefined;
    this.startTick();
    this.changed();
    const fetcher = this.fetchers.get(job.id) || this.fetcher;
    try {
      fs.mkdirSync(job.folder, { recursive: true });
      if (!job.parts.length) {
        const info = await probe(job.url, fetcher, abort.signal);
        job.size = info.size;
        job.name = freeName(job.folder, job.name || info.name);
        job.parts =
          info.ranges && info.size
            ? split(info.size, this.settings.connections)
            : [{ start: 0, end: Math.max(0, info.size - 1), done: 0 }];
        job.ranged = info.ranges;
      }
      const ranged = !!job.ranged;
      // A plain stream cannot continue mid-way; it starts again.
      if (!ranged) {
        job.parts = [{ start: 0, end: Math.max(0, job.size - 1), done: 0 }];
        job.received = 0;
      }
      const part = path.join(job.folder, job.name + ".yamipart");
      const handle = await fs.promises.open(
        part,
        fs.existsSync(part) ? "r+" : "w",
      );
      try {
        await Promise.all(
          job.parts.map((p) =>
            fetchPart(
              job,
              p,
              handle,
              fetcher,
              abort.signal,
              (n) => {
                job.received += n;
                this.window.set(job.id, (this.window.get(job.id) || 0) + n);
              },
              ranged,
            ),
          ),
        );
      } finally {
        await handle.close();
      }
      if (job.size && job.received < job.size)
        throw new Error(
          "The server closed the connection early. Resume to finish.",
        );
      // Its own part file is not a clash; only a finished file of that name is.
      const final = path.join(
        job.folder,
        fs.existsSync(path.join(job.folder, job.name))
          ? freeName(job.folder, job.name)
          : job.name,
      );
      await fs.promises.rename(part, final);
      job.file = final;
      job.name = path.basename(final);
      job.size ||= job.received;
      job.state = "done";
      job.finished = Date.now();
    } catch (error) {
      if (abort.signal.aborted)
        job.state = job.state === "downloading" ? "paused" : job.state;
      else {
        job.state = "error";
        job.error = (error as Error).message;
      }
    } finally {
      job.speed = 0;
      this.running.delete(job.id);
      this.save(true);
      this.publish(this.jobs);
      this.pump();
      if (!this.running.size) this.stopTick();
    }
  }

  private startTick() {
    this.tick ||= setInterval(() => {
      for (const job of this.jobs)
        if (job.state === "downloading") {
          job.speed = (this.window.get(job.id) || 0) * 2;
          this.window.set(job.id, 0);
        }
      this.publish(this.jobs);
    }, 500);
  }

  private stopTick() {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  private find(id: unknown) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) throw new Error("That download is not in the list.");
    return job;
  }

  pause(id: unknown) {
    const job = this.find(id);
    if (job.state === "queued") job.state = "paused";
    else if (job.state === "downloading") {
      job.state = "paused";
      this.running.get(job.id)?.abort();
    }
    this.changed();
    return this.list();
  }

  resume(id: unknown) {
    const job = this.find(id);
    if (job.state === "paused" || job.state === "error") {
      job.state = "queued";
      this.changed();
      this.pump();
    }
    return this.list();
  }

  /** Stops it and deletes the unfinished part; a finished file is kept. */
  remove(id: unknown, deleteFile = false) {
    const job = this.find(id);
    this.running.get(job.id)?.abort();
    this.jobs = this.jobs.filter((j) => j !== job);
    if (job.state !== "done")
      fs.rmSync(path.join(job.folder, job.name + ".yamipart"), { force: true });
    else if (deleteFile && job.file) fs.rmSync(job.file, { force: true });
    this.changed();
    return this.list();
  }

  clearFinished() {
    this.jobs = this.jobs.filter((j) => j.state !== "done");
    this.changed();
    return this.list();
  }

  set(a: { connections?: unknown; active?: unknown; folder?: unknown }) {
    const c = Number(a.connections),
      n = Number(a.active);
    if (a.connections !== undefined && Number.isInteger(c) && c >= 1 && c <= 8)
      this.settings.connections = c;
    if (a.active !== undefined && Number.isInteger(n) && n >= 1 && n <= 5)
      this.settings.active = n;
    if (typeof a.folder === "string" && path.isAbsolute(a.folder))
      this.settings.folder = a.folder;
    this.save(true);
    return this.list();
  }

  dispose() {
    for (const a of this.running.values()) a.abort();
    this.stopTick();
    this.save(true);
  }
}
