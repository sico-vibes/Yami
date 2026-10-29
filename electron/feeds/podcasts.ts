// Podcast search for the Inbox: Apple's iTunes Search API (free, no key,
// about 20 requests a minute) finds shows by name; following one adds its
// public RSS feed, which the feed reader then reads like any other.

export type PodcastResult = { name: string; author: string; feed: string };

export async function searchPodcasts(
  term: unknown,
  fetcher: typeof fetch = fetch,
): Promise<PodcastResult[]> {
  const q = String(term || "").trim();
  if (q.length < 2 || q.length > 100) throw new Error("Type a podcast name.");
  const response = await fetcher(
    `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=8&term=${encodeURIComponent(q)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (response.status === 403 || response.status === 429)
    throw new Error("Apple asked Yami to slow down. Try again in a minute.");
  if (!response.ok) throw new Error("Podcast search is unavailable.");
  const json: any = await response.json().catch(() => ({}));
  const seen = new Set<string>();
  const out: PodcastResult[] = [];
  for (const r of Array.isArray(json.results) ? json.results : []) {
    const feed = String(r?.feedUrl || "");
    // Only HTTPS feeds, like every other feed source.
    if (!/^https:\/\//i.test(feed) || seen.has(feed)) continue;
    seen.add(feed);
    out.push({
      name: String(r.collectionName || r.trackName || "Podcast").slice(0, 120),
      author: String(r.artistName || "").slice(0, 120),
      feed,
    });
  }
  return out;
}
