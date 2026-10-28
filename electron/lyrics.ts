import { boundedText } from "./workbench/network.ts";
import { parseLrc, type LyricLine } from "../src/lyrics-line.ts";

export type Lyrics = { lines: LyricLine[]; plain: string; source: "lrclib" };

const cache = new Map<string, Lyrics | null>();

/**
 * Lyrics from LRCLIB (lrclib.net), a free community database without keys.
 * Only the artist, title and length are sent. Results, including "none", are
 * kept for the session so a track is asked about once.
 */
export async function findLyrics(
  artist: string,
  title: string,
  duration: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Lyrics | null> {
  const a = artist.trim().slice(0, 200),
    t = title.trim().slice(0, 200);
  if (!t) return null;
  const key = `${a}\n${t}\n${Math.round(duration)}`;
  if (cache.has(key)) return cache.get(key)!;
  const query = new URLSearchParams({ artist_name: a, track_name: t });
  if (duration > 0) query.set("duration", String(Math.round(duration)));
  const response = await fetchImpl(`https://lrclib.net/api/get?${query}`, {
    headers: { "User-Agent": "Yami desktop companion (lyrics on request)" },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) {
    await response.body?.cancel();
    cache.set(key, null);
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`LRCLIB returned HTTP ${response.status}.`);
  }
  const body = JSON.parse(await boundedText(response, 512 * 1024));
  const result: Lyrics | null =
    body.instrumental || (!body.syncedLyrics && !body.plainLyrics)
      ? null
      : {
          lines: parseLrc(String(body.syncedLyrics || "")),
          plain: String(body.plainLyrics || "").slice(0, 20000),
          source: "lrclib",
        };
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
