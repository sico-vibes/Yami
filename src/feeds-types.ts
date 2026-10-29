// Feeds for the Desk inbox: public RSS, Atom and JSON Feed sources, read when
// the inbox opens or you refresh. Nothing signs in and nothing is posted.

export type FeedKind =
  | "reddit"
  | "hackernews"
  | "github"
  | "youtube"
  | "bluesky"
  | "mastodon"
  | "url"
  | "podcast";

export type FeedSource = {
  id: string;
  kind: FeedKind;
  name: string;
  url: string;
  added: number;
};

export type FeedItem = {
  id: string;
  source: string;
  title: string;
  link: string;
  at: number;
  summary?: string;
  author?: string;
};

export type FeedStatus = {
  id: string;
  state: "fresh" | "cached" | "error";
  fetchedAt?: number;
  error?: string;
};

/** A mail account for the glance; its app password never leaves the main process. */
export type MailAccount = {
  id: string;
  provider: string;
  host: string;
  user: string;
  added: number;
  glance?: {
    unread: number;
    total: number;
    latest: { from: string; subject: string; at: number }[];
  };
  error?: string;
  checkedAt?: number;
};

export type FeedsView = {
  sources: FeedSource[];
  /** Newest first, across sources, at most 200. */
  items: FeedItem[];
  status: FeedStatus[];
};

export const feedKinds: {
  kind: FeedKind;
  label: string;
  icon: string;
  placeholder: string;
}[] = [
  {
    kind: "reddit",
    label: "Reddit",
    icon: "reddit-logo",
    placeholder: "r/rust",
  },
  {
    kind: "hackernews",
    label: "Hacker News",
    icon: "newspaper",
    placeholder: "Front page",
  },
  {
    kind: "github",
    label: "GitHub releases",
    icon: "github-logo",
    placeholder: "owner/repo",
  },
  {
    kind: "youtube",
    label: "YouTube channel",
    icon: "youtube-logo",
    placeholder: "Channel ID (UC…)",
  },
  {
    kind: "podcast",
    label: "Podcast",
    icon: "microphone-stage",
    placeholder: "Search podcasts by name",
  },
  {
    kind: "bluesky",
    label: "Bluesky profile",
    icon: "butterfly",
    placeholder: "name.bsky.social",
  },
  {
    kind: "mastodon",
    label: "Mastodon account",
    icon: "mastodon-logo",
    placeholder: "@user@mastodon.social",
  },
  {
    kind: "url",
    label: "Any feed",
    icon: "rss",
    placeholder: "https://example.com/feed.xml",
  },
];

/**
 * Requests: `feeds.list` → FeedsView (the cache, instantly); `feeds.refresh`
 * { id? } → FeedsView after reading the sources again; `feeds.add`
 * { kind, value } → FeedSource; `feeds.remove` { id }.
 */
