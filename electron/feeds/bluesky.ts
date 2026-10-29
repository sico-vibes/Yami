import fs from "node:fs";
import path from "node:path";

// Bluesky home timeline for the Inbox: you sign in once with an app
// password (Settings › Privacy and security › App passwords on Bluesky),
// Yami keeps only the session's refresh token, encrypted, and reads the
// Following timeline when the Inbox opens. Read-only: no posting, liking
// or following, and no images are loaded.

export type BlueskyPost = {
  id: string;
  author: string;
  handle: string;
  text: string;
  link: string;
  at: number;
  /** "Reposted by …" when the post came from a repost. */
  note?: string;
};
export type BlueskyStatus = {
  handle?: string;
  posts: BlueskyPost[];
  fetchedAt?: number;
  error?: string;
};

type Secrets = {
  get(id: string): string;
  set(id: string, value: string): void;
};
type Saved = { handle?: string; did?: string; pds?: string };
const ENTRYWAY = "https://bsky.social";
const SECRET = "bluesky";

export class BlueskyHome {
  private saved: Saved;
  private access?: string;
  private last: Omit<BlueskyStatus, "handle"> = { posts: [] };
  constructor(
    private file: string,
    private secrets: Secrets,
    private fetcher: typeof fetch = fetch,
  ) {
    try {
      this.saved = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      this.saved = {};
    }
  }

  status(): BlueskyStatus {
    return { handle: this.saved.handle, ...this.last };
  }

  private async call(url: string, init: RequestInit = {}) {
    const response = await this.fetcher(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers || {}) },
      signal: AbortSignal.timeout(15000),
    });
    const json: any = await response.json().catch(() => ({}));
    return { status: response.status, json };
  }

  private keep(session: any) {
    const pds =
      session.didDoc?.service?.find?.(
        (s: any) => s.type === "AtprotoPersonalDataServer",
      )?.serviceEndpoint ||
      this.saved.pds ||
      ENTRYWAY;
    if (!/^https:\/\//.test(pds)) throw new Error("Bluesky answered oddly.");
    this.access = String(session.accessJwt);
    this.secrets.set(SECRET, String(session.refreshJwt));
    this.saved = {
      handle: String(session.handle),
      did: String(session.did),
      pds,
    };
    this.save();
  }

  async signIn(identifier: unknown, password: unknown) {
    const id = String(identifier || "")
      .trim()
      .replace(/^@/, "");
    const secret = String(password || "").trim();
    if (!id || id.length > 253) throw new Error("Enter your Bluesky handle.");
    if (!/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(secret))
      throw new Error(
        "Use an app password (xxxx-xxxx-xxxx-xxxx) from Bluesky's settings, not your main password.",
      );
    const { status, json } = await this.call(
      `${ENTRYWAY}/xrpc/com.atproto.server.createSession`,
      {
        method: "POST",
        body: JSON.stringify({ identifier: id, password: secret }),
      },
    );
    if (status !== 200 || !json.accessJwt)
      throw new Error(
        status === 401
          ? "Bluesky refused that handle or app password."
          : json.message || `Bluesky answered ${status}.`,
      );
    this.keep(json);
    return this.refresh();
  }

  signOut() {
    this.secrets.set(SECRET, "");
    this.access = undefined;
    this.saved = {};
    this.last = { posts: [] };
    this.save();
    return this.status();
  }

  private async renew() {
    const refresh = this.secrets.get(SECRET);
    if (!refresh) throw new Error("Sign in to Bluesky again.");
    const { status, json } = await this.call(
      `${this.saved.pds}/xrpc/com.atproto.server.refreshSession`,
      { method: "POST", headers: { authorization: `Bearer ${refresh}` } },
    );
    if (status !== 200 || !json.accessJwt)
      throw new Error("The Bluesky sign-in expired. Sign in again.");
    this.keep(json);
  }

  /** Reads the Following timeline; a failure keeps the last posts. */
  async refresh(): Promise<BlueskyStatus> {
    if (!this.saved.handle) return this.status();
    try {
      if (!this.access) await this.renew();
      const read = () =>
        this.call(`${this.saved.pds}/xrpc/app.bsky.feed.getTimeline?limit=30`, {
          headers: { authorization: `Bearer ${this.access}` },
        });
      let { status, json } = await read();
      if (status === 400 && /ExpiredToken/i.test(json.error || "")) {
        await this.renew();
        ({ status, json } = await read());
      }
      if (status !== 200)
        throw new Error(json.message || `Bluesky answered ${status}.`);
      this.last = { posts: posts(json.feed), fetchedAt: Date.now() };
    } catch (error) {
      this.last = {
        ...this.last,
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "Bluesky did not answer in 15 seconds."
            : (error as Error).message,
      };
    }
    return this.status();
  }

  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + ".tmp", JSON.stringify(this.saved));
    fs.renameSync(this.file + ".tmp", this.file);
  }
}

/** Timeline entries as plain text posts with a bsky.app link. */
export function posts(feed: unknown): BlueskyPost[] {
  const out: BlueskyPost[] = [];
  for (const entry of Array.isArray(feed) ? feed.slice(0, 50) : []) {
    const post = entry?.post;
    const uri = String(post?.uri || "");
    const rkey = /\/app\.bsky\.feed\.post\/([^/]+)$/.exec(uri)?.[1];
    const handle = String(post?.author?.handle || "");
    if (!rkey || !/^[a-z0-9.-]+$/i.test(handle)) continue;
    const at = Date.parse(post.record?.createdAt || post.indexedAt || "");
    const by = entry.reason?.by;
    out.push({
      id: uri,
      author: String(post.author.displayName || handle).slice(0, 80),
      handle,
      text: String(post.record?.text || "").slice(0, 600),
      link: `https://bsky.app/profile/${handle}/post/${rkey}`,
      at: Number.isFinite(at) ? at : 0,
      ...(String(entry.reason?.$type || "").endsWith("#reasonRepost") &&
        by && {
          note: `Reposted by ${String(by.displayName || by.handle).slice(0, 80)}`,
        }),
    });
  }
  return out;
}
