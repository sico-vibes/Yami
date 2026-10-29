import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  FeedItem,
  FeedSource,
  FeedStatus,
  FeedsView,
} from "../../src/feeds-types.ts";
import { boundedText } from "../workbench/network.ts";
import { feedAddress, parseFeed } from "./parse.ts";

type Cache = {
  etag?: string;
  modified?: string;
  fetchedAt?: number;
  items: FeedItem[];
  error?: string;
};
type Saved = { sources: FeedSource[]; cache: Record<string, Cache> };

const kinds = [
  "reddit",
  "hackernews",
  "github",
  "youtube",
  "bluesky",
  "mastodon",
  "podcast",
  "url",
];

/**
 * Reads feeds when asked, never on a timer. Each request sends the saved
 * ETag and Last-Modified, so an unchanged feed costs one small reply.
 */
export class FeedsController {
  private saved: Saved;
  private pending?: Promise<FeedsView>;
  constructor(
    private file: string,
    private fetchImpl: typeof fetch = fetch,
  ) {
    let saved: Partial<Saved> = {};
    try {
      saved = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {}
    this.saved = { sources: saved.sources || [], cache: saved.cache || {} };
  }

  view(): FeedsView {
    const { sources, cache } = this.saved;
    const items = sources
      .flatMap((s) => cache[s.id]?.items || [])
      .sort((a, b) => b.at - a.at)
      .slice(0, 200);
    const status: FeedStatus[] = sources.map((s) => {
      const c = cache[s.id];
      return {
        id: s.id,
        state: c?.error ? "error" : c?.fetchedAt ? "fresh" : "cached",
        fetchedAt: c?.fetchedAt,
        error: c?.error,
      };
    });
    return { sources, items, status };
  }

  add(kind: unknown, value: unknown, label?: unknown) {
    if (!kinds.includes(String(kind))) throw new Error("Choose a feed type.");
    const { url, name } = feedAddress(
      kind as FeedSource["kind"],
      String(value ?? ""),
    );
    const existing = this.saved.sources.find((s) => s.url === url);
    if (existing) return existing;
    if (this.saved.sources.length >= 50)
      throw new Error("Remove a feed before adding another (up to 50).");
    const source: FeedSource = {
      id: randomUUID(),
      kind: kind as FeedSource["kind"],
      // A podcast keeps the show's name from the search.
      name:
        kind === "podcast" && typeof label === "string" && label.trim()
          ? label.trim().slice(0, 120)
          : name,
      url,
      added: Date.now(),
    };
    this.saved.sources.push(source);
    this.save();
    return source;
  }

  remove(id: string) {
    this.saved.sources = this.saved.sources.filter((s) => s.id !== id);
    delete this.saved.cache[id];
    this.save();
    return this.view();
  }

  /** Reads every source (or one), three at a time; one refresh at a time. */
  refresh(id?: string) {
    this.pending ??= (async () => {
      try {
        const list = this.saved.sources.filter((s) => !id || s.id === id);
        for (let i = 0; i < list.length; i += 3)
          await Promise.all(list.slice(i, i + 3).map((s) => this.read(s)));
        this.save();
        return this.view();
      } finally {
        this.pending = undefined;
      }
    })();
    return this.pending;
  }

  private async read(source: FeedSource) {
    const old = this.saved.cache[source.id] || { items: [] };
    try {
      const response = await this.fetchImpl(source.url, {
        headers: {
          Accept:
            "application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, */*;q=0.5",
          "User-Agent": "Yami desktop feed reader",
          ...(old.etag && { "If-None-Match": old.etag }),
          ...(old.modified && { "If-Modified-Since": old.modified }),
        },
        signal: AbortSignal.timeout(15000),
      });
      if (response.url && !response.url.startsWith("https://"))
        throw new Error("The feed moved to an address without HTTPS.");
      if (response.status === 304) {
        await response.body?.cancel();
        this.saved.cache[source.id] = {
          ...old,
          fetchedAt: Date.now(),
          error: undefined,
        };
        return;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(
          response.status === 429
            ? "The site asked Yami to slow down. Try again later."
            : `The feed returned HTTP ${response.status}.`,
        );
      }
      // Podcast feeds list every episode and are often several megabytes.
      const items = parseFeed(
        await boundedText(
          response,
          source.kind === "podcast" ? 8 * 1024 * 1024 : undefined,
        ),
        source.id,
      );
      this.saved.cache[source.id] = {
        etag: response.headers.get("etag") || undefined,
        modified: response.headers.get("last-modified") || undefined,
        fetchedAt: Date.now(),
        items,
      };
    } catch (error) {
      // Keep what was read before; show why this read failed.
      this.saved.cache[source.id] = {
        ...old,
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "The feed did not answer in 15 seconds."
            : error instanceof Error
              ? error.message
              : "The feed could not be read.",
      };
    }
  }

  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.saved));
    fs.renameSync(temp, this.file);
  }
}
