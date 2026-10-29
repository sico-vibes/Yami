import fs from "node:fs";
import path from "node:path";

// Radio Browser's station directory: search, popular stations and kept
// favourites. Kept apart from the protocol handler so tests can load it.

export type Station = {
  id: string;
  name: string;
  country: string;
  tags: string;
  codec: string;
  bitrate: number;
};

const servers = ["de1", "nl1", "at1", "fi1"].map(
  (s) => `https://${s}.api.radio-browser.info`,
);
export const HEADERS = { "User-Agent": "Yami/0.2 (Windows desktop companion)" };
/** Stream addresses of stations Yami has shown, by station id. */
export const streams = new Map<string, string>();

function station(s: any): Station | undefined {
  const url = String(s?.url_resolved || s?.url || "");
  const id = String(s?.stationuuid || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^https?:\/\//i.test(url))
    return undefined;
  streams.set(id, url);
  return {
    id,
    name: String(s.name || "Station")
      .trim()
      .slice(0, 100),
    country: String(s.country || "").slice(0, 60),
    tags: String(s.tags || "")
      .split(",")
      .slice(0, 4)
      .join(", ")
      .slice(0, 80),
    codec: String(s.codec || "").slice(0, 12),
    bitrate: Number(s.bitrate) || 0,
  };
}

export class Radio {
  constructor(
    private dataDir: string,
    private fetcher: typeof fetch = fetch,
  ) {
    // Favourites can play straight away after a restart.
    for (const s of this.favourites()) if (s.url) streams.set(s.id, s.url);
  }

  private file = () => path.join(this.dataDir, "radio.json");

  /** Tries the directory's mirrors in turn. */
  private async ask(query: string) {
    let last: unknown;
    for (const base of servers) {
      try {
        const r = await this.fetcher(`${base}/json/${query}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(8000),
        });
        if (r.ok) return (await r.json()) as any[];
        last = new Error(String(r.status));
      } catch (error) {
        last = error;
      }
    }
    throw new Error("The radio directory could not be reached.", {
      cause: last,
    });
  }

  async search(term: unknown): Promise<Station[]> {
    const q = String(term || "")
      .trim()
      .slice(0, 80);
    const list = q
      ? await this.ask(
          `stations/search?name=${encodeURIComponent(q)}&limit=24&hidebroken=true&order=clickcount&reverse=true`,
        )
      : await this.ask("stations/topclick/24?hidebroken=true");
    return (Array.isArray(list) ? list : [])
      .map(station)
      .filter((s): s is Station => !!s);
  }

  favourites(): (Station & { url?: string })[] {
    try {
      const list = JSON.parse(fs.readFileSync(this.file(), "utf8"));
      return Array.isArray(list) ? list.slice(0, 50) : [];
    } catch {
      return [];
    }
  }

  /** Saves or forgets a station Yami has listed. */
  favourite(s: Station, on: boolean) {
    const url = streams.get(String(s?.id));
    if (!url) throw new Error("Search for the station first.");
    const list = this.favourites().filter((f) => f.id !== s.id);
    if (on)
      list.unshift({
        id: s.id,
        name: String(s.name).slice(0, 100),
        country: String(s.country || "").slice(0, 60),
        tags: String(s.tags || "").slice(0, 80),
        codec: String(s.codec || "").slice(0, 12),
        bitrate: Number(s.bitrate) || 0,
        url,
      });
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.file(), JSON.stringify(list.slice(0, 50)));
    return this.favourites().map(({ url: _url, ...rest }) => rest);
  }
}
