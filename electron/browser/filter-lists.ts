import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import type { FiltersEngine } from "@ghostery/adblocker";

// Full ad-block filter lists for the Yami Browser, downloaded only when the
// user turns them on. The engine (Ghostery's, MPL-2.0) is loaded the first
// time it is needed and kept as a compact file, so later starts skip parsing.
// Lists refresh when the browser opens and a copy is a week old; there is no
// background timer.

export const filterLists = [
  {
    id: "easylist",
    name: "EasyList",
    url: "https://easylist.to/easylist/easylist.txt",
  },
  {
    id: "easyprivacy",
    name: "EasyPrivacy",
    url: "https://easylist.to/easylist/easyprivacy.txt",
  },
] as const;

/** Class names, ids and links on a page, read in an isolated world. */
export type PageNames = { classes: string[]; ids: string[]; hrefs: string[] };

/** Reads the names without touching the page; bounded for huge documents. */
export const pageNamesScript = `(() => {
  const classes = new Set(), ids = new Set(), hrefs = new Set();
  const all = document.querySelectorAll("[class],[id],a[href]");
  for (let i = 0; i < all.length && i < 20000; i++) {
    const el = all[i];
    if (classes.size < 5000) el.classList.forEach((c) => classes.add(c));
    if (el.id && ids.size < 2000) ids.add(el.id);
    const href = el.getAttribute("href");
    if (href && hrefs.size < 1000) hrefs.add(href);
  }
  return { classes: [...classes], ids: [...ids], hrefs: [...hrefs] };
})()`;

const MAX_LIST = 8 * 1024 * 1024;
const STALE_AFTER = 7 * 24 * 60 * 60_000;
type Meta = Record<
  string,
  {
    updated: number;
    bytes: number;
    rules: number;
    etag?: string;
    modified?: string;
  }
>;

export type FilterStatus = {
  installed: boolean;
  loaded: boolean;
  rules: number;
  updating: boolean;
  lists: { id: string; name: string; updated: number; bytes: number }[];
  error?: string;
};

type Lib = typeof import("@ghostery/adblocker");
let lib: Lib | undefined;
const engineModule = async () => (lib ||= await import("@ghostery/adblocker"));

export class FilterLists {
  private engine?: FiltersEngine;
  private loading?: Promise<FiltersEngine | undefined>;
  private updating?: Promise<FilterStatus>;
  private error = "";

  constructor(
    private dir: string,
    private fetcher: typeof fetch = fetch,
    /** Builds the engine file; a child process unless a test passes one. */
    private build: (lists: string[], out: string) => Promise<void> = inChild,
  ) {}

  private file = (name: string) => path.join(this.dir, name);
  private meta(): Meta {
    try {
      return JSON.parse(fs.readFileSync(this.file("lists.json"), "utf8"));
    } catch {
      return {};
    }
  }
  private installed() {
    return fs.existsSync(this.file("engine.bin"));
  }

  status(): FilterStatus {
    const meta = this.meta();
    return {
      installed: this.installed(),
      loaded: !!this.engine,
      rules: filterLists.reduce((n, l) => n + (meta[l.id]?.rules || 0), 0),
      updating: !!this.updating,
      lists: filterLists.map((l) => ({
        id: l.id,
        name: l.name,
        updated: meta[l.id]?.updated || 0,
        bytes: meta[l.id]?.bytes || 0,
      })),
      ...(this.error && { error: this.error }),
    };
  }

  /** The engine, read from disk the first time; undefined until installed. */
  async get() {
    if (this.engine || !this.installed()) return this.engine;
    this.loading ||= (async () => {
      try {
        const { FiltersEngine } = await engineModule();
        const engine = FiltersEngine.deserialize(
          new Uint8Array(await fs.promises.readFile(this.file("engine.bin"))),
        );
        this.engine = engine;
        return engine;
      } catch (error) {
        this.error = "The saved filter lists could not be read. Update them.";
        return undefined;
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  /** True once the lists are in memory. */
  get active() {
    return !!this.engine && !!lib;
  }

  /**
   * Whether a subresource is blocked, answered from memory so requests never
   * wait. Pages the user opens are never blocked here.
   */
  blocks(details: { url: string; referrer?: string; resourceType: string }) {
    if (!this.engine || !lib || details.resourceType === "mainFrame")
      return false;
    const request = lib.Request.fromRawDetails({
      url: details.url,
      sourceUrl: details.referrer || "",
      type: details.resourceType as any,
    });
    return this.engine.match(request).match;
  }

  /**
   * Element-hiding CSS for a page: rules for its site, generic ones, and the
   * generic class and id rules that match names the page actually uses.
   */
  hidingCss(url: string, dom?: PageNames) {
    if (!this.engine || !lib) return "";
    const page = lib.Request.fromRawDetails({ url });
    return this.engine.getCosmeticsFilters({
      url,
      hostname: page.hostname,
      domain: page.domain || "",
      getBaseRules: true,
      getInjectionRules: false,
      getExtendedRules: false,
      getRulesFromDOM: !!dom,
      getRulesFromHostname: true,
      ...(dom && { classes: dom.classes, ids: dom.ids, hrefs: dom.hrefs }),
    }).styles;
  }

  /** Downloads both lists (sending ETag / Last-Modified) and rebuilds. */
  update(): Promise<FilterStatus> {
    this.updating ||= (async () => {
      try {
        await fs.promises.mkdir(this.dir, { recursive: true });
        const meta = this.meta();
        for (const list of filterLists) {
          const saved = meta[list.id];
          const target = this.file(list.id + ".txt");
          const headers: Record<string, string> = {};
          if (saved?.etag && fs.existsSync(target))
            headers["If-None-Match"] = saved.etag;
          if (saved?.modified && fs.existsSync(target))
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
          const text = await response.text();
          if (text.length > MAX_LIST)
            throw new Error(`${list.name} is larger than expected.`);
          if (!/^\[Adblock/i.test(text.slice(0, 200)) && !text.includes("##"))
            throw new Error(`${list.name} did not look like a filter list.`);
          await fs.promises.writeFile(target, text, "utf8");
          meta[list.id] = {
            updated: Date.now(),
            bytes: Buffer.byteLength(text),
            // Lines that are rules: not blank, not a "!" comment or header.
            rules: text
              .split("\n")
              .filter((l) => l.trim() && !/^\s*(!|\[)/.test(l)).length,
            etag: response.headers.get("etag") || undefined,
            modified: response.headers.get("last-modified") || undefined,
          };
        }
        // Parsing 130,000 rules leaves about 120 MB that a process keeps
        // (a worker thread did not return it), so a short-lived process
        // builds the compact file and the main process only reads it back.
        await this.build(
          filterLists.map((l) => this.file(l.id + ".txt")),
          this.file("engine.bin"),
        );
        await fs.promises.writeFile(
          this.file("lists.json"),
          JSON.stringify(meta),
        );
        this.engine = undefined;
        this.error = "";
        await this.get();
      } catch (error) {
        this.error =
          (error as Error).name === "TimeoutError"
            ? "The filter lists took too long to download."
            : (error as Error).message;
      } finally {
        this.updating = undefined;
      }
      return this.status();
    })();
    return this.updating;
  }

  /** Called when the browser opens: refresh a week-old copy in the background. */
  refreshIfStale(now = Date.now()) {
    if (!this.installed() || this.updating) return false;
    const meta = this.meta();
    if (
      filterLists.every((l) => now - (meta[l.id]?.updated || 0) < STALE_AFTER)
    )
      return false;
    void this.update();
    return true;
  }

  /** Deletes the lists and frees the engine. */
  async remove() {
    this.engine = undefined;
    this.error = "";
    await fs.promises.rm(this.dir, { recursive: true, force: true });
    return this.status();
  }
}

/** Runs filter-build.cjs (bundled next to main.cjs) as its own process. */
function inChild(lists: string[], out: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
  delete env.NODE_OPTIONS;
  return new Promise<void>((resolve, reject) => {
    execFile(
      process.execPath,
      [path.join(__dirname, "filter-build.cjs"), JSON.stringify([lists, out])],
      { env, windowsHide: true, timeout: 120_000 },
      (error, _stdout, stderr) =>
        error
          ? reject(
              new Error(
                String(stderr).trim() || "The filter lists could not be built.",
              ),
            )
          : resolve(),
    );
  });
}
