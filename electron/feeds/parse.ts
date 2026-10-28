import type { FeedItem, FeedKind } from "../../src/feeds-types.ts";

// A small, tolerant reader for RSS 2.0, Atom and JSON Feed. Feeds are
// untrusted text: links must be http(s), titles and summaries are plain text.

const named: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decode(text: string) {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, code: string) => {
      if (code[0] === "#") {
        const n =
          code[1].toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : Number(code.slice(1));
        return Number.isFinite(n) && n > 0 && n < 0x110000
          ? String.fromCodePoint(n)
          : whole;
      }
      return named[code.toLowerCase()] ?? whole;
    },
  );
}

/** Plain text from feed markup: CDATA opened, tags dropped, entities read. */
export function plain(text: string, max = 280) {
  const opened = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Entities first, so escaped HTML in descriptions loses its tags too.
  const once = decode(opened);
  const out = decode(once.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return out.length > max ? out.slice(0, max - 1).trimEnd() + "…" : out;
}

const tag = (block: string, name: string) => {
  const match = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,
    "i",
  ).exec(block);
  return match ? match[1] : "";
};
const attr = (element: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(element)?.[1] ||
  "";

export function safeLink(value: string) {
  try {
    const url = new URL(decode(value.trim()));
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function atomLink(entry: string) {
  const links = entry.match(/<link\b[^>]*>/gi) || [];
  const alternate = links.find(
    (l) => !/rel\s*=/i.test(l) || /rel\s*=\s*["']alternate["']/i.test(l),
  );
  return attr(alternate || links[0] || "", "href");
}

/** Items from a feed body; `source` is the source id they belong to. */
export function parseFeed(
  body: string,
  source: string,
  limit = 50,
): FeedItem[] {
  const text = body.trim();
  const items: FeedItem[] = [];
  const push = (raw: {
    id?: string;
    title: string;
    link: string;
    at?: string;
    summary?: string;
    author?: string;
  }) => {
    const link = safeLink(raw.link);
    // Social posts (Bluesky, Mastodon) have no title; their text is the title.
    const titled = !!plain(raw.title || "", 300);
    const title = titled
      ? plain(raw.title, 300)
      : plain(raw.summary || "", 200);
    if (!link || !title) return;
    const at = Date.parse(raw.at || "");
    items.push({
      id: source + ":" + (raw.id?.trim() || link),
      source,
      title,
      link,
      at: Number.isFinite(at) ? at : 0,
      ...(titled && raw.summary && { summary: plain(raw.summary) }),
      ...(raw.author && { author: plain(raw.author, 80) }),
    });
  };
  if (text.startsWith("{")) {
    const feed = JSON.parse(text);
    if (!/jsonfeed/.test(String(feed.version)) || !Array.isArray(feed.items))
      throw new Error("This JSON is not a JSON Feed.");
    for (const it of feed.items.slice(0, limit))
      push({
        id: String(it.id ?? ""),
        title: String(it.title ?? it.content_text ?? "").slice(0, 2000),
        link: String(it.url ?? it.external_url ?? ""),
        at: it.date_published ?? it.date_modified,
        summary: it.summary ?? it.content_text,
        author: it.authors?.[0]?.name ?? it.author?.name,
      });
    return items;
  }
  if (/<feed\b/i.test(text)) {
    for (const [entry] of text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)) {
      if (items.length >= limit) break;
      push({
        id: tag(entry, "id"),
        title: tag(entry, "title"),
        link: atomLink(entry),
        at: tag(entry, "published") || tag(entry, "updated"),
        summary:
          tag(entry, "summary") ||
          tag(entry, "media:description") ||
          tag(entry, "content"),
        author: tag(tag(entry, "author"), "name"),
      });
    }
    return items;
  }
  if (/<rss\b|<rdf:RDF\b|<channel\b/i.test(text)) {
    for (const [item] of text.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
      if (items.length >= limit) break;
      push({
        id: tag(item, "guid"),
        title: tag(item, "title"),
        link: tag(item, "link").replace(/<!\[CDATA\[|\]\]>/g, ""),
        at: tag(item, "pubDate") || tag(item, "dc:date"),
        summary: tag(item, "description"),
        author: tag(item, "dc:creator") || tag(item, "author"),
      });
    }
    return items;
  }
  throw new Error("This address did not return an RSS, Atom or JSON feed.");
}

/** The feed address and a name for what you typed. */
export function feedAddress(
  kind: FeedKind,
  value: string,
): { url: string; name: string } {
  const v = value.trim();
  if (kind === "hackernews")
    return { url: "https://news.ycombinator.com/rss", name: "Hacker News" };
  if (kind === "reddit") {
    const sub = v.replace(/^\/?r\//i, "").replace(/\/+$/, "");
    if (!/^[A-Za-z0-9_]{2,21}$/.test(sub))
      throw new Error("Enter a subreddit like r/rust.");
    return { url: `https://www.reddit.com/r/${sub}/.rss`, name: `r/${sub}` };
  }
  if (kind === "github") {
    const repo = v.replace(/^https:\/\/github\.com\//i, "").replace(/\/+$/, "");
    if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(repo))
      throw new Error("Enter a repository like owner/repo.");
    return { url: `https://github.com/${repo}/releases.atom`, name: repo };
  }
  if (kind === "bluesky") {
    const handle = v.replace(/^@/, "").toLowerCase();
    if (!/^(?=.{3,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(handle))
      throw new Error("Enter a Bluesky handle like name.bsky.social.");
    return {
      url: `https://bsky.app/profile/${handle}/rss`,
      name: "@" + handle,
    };
  }
  if (kind === "mastodon") {
    const match =
      /^@?([A-Za-z0-9_]{1,30})@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i.exec(v);
    if (!match)
      throw new Error("Enter a Mastodon account like @user@mastodon.social.");
    const [, user, host] = match;
    return {
      url: `https://${host.toLowerCase()}/@${user}.rss`,
      name: `@${user}@${host.toLowerCase()}`,
    };
  }
  if (kind === "youtube") {
    if (!/^UC[A-Za-z0-9_-]{22}$/.test(v))
      throw new Error("Enter a YouTube channel ID, which starts with UC.");
    return {
      url: `https://www.youtube.com/feeds/videos.xml?channel_id=${v}`,
      name: "YouTube " + v.slice(0, 8) + "…",
    };
  }
  const url = safeLink(v);
  if (!url.startsWith("https:"))
    throw new Error("Enter a feed address that starts with https://.");
  const parsed = new URL(url);
  if (parsed.username || parsed.password)
    throw new Error("Keep credentials out of the feed address.");
  return { url, name: parsed.hostname.replace(/^www\./, "") };
}
