import { useEffect, useState } from "react";
import { api } from "../api";
import { relativeTime, StatusChip } from "../controls";
import { Icon, IconButton } from "../ui";

type Post = {
  id: string;
  author: string;
  handle: string;
  text: string;
  link: string;
  at: number;
  note?: string;
};
type Status = {
  handle?: string;
  posts: Post[];
  fetchedAt?: number;
  error?: string;
};

/**
 * Bluesky's Following timeline in the Inbox, after signing in once with an
 * app password. Read-only; posts open on bsky.app.
 */
export function BlueskyHome({ report }: { report: (m: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null),
    [adding, setAdding] = useState(false),
    [handle, setHandle] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false);
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("feeds.bluesky")
      .then((s: Status) => {
        setStatus(s);
        if (s.handle)
          void api("feeds.bluesky.refresh").then(setStatus).catch(fail);
      })
      .catch(fail);
  }, []);
  const signIn = () => {
    setBusy(true);
    void api("feeds.bluesky.signIn", { handle, password })
      .then((s) => {
        setStatus(s);
        setAdding(false);
        setPassword("");
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  if (!status) return null;
  const open = (url: string) => void api("open.external", { url }).catch(fail);
  return (
    <section className="mail-glance">
      <div className="mail-head">
        <h3 className="group-title">Bluesky</h3>
        {!status.handle && !adding && (
          <button
            type="button"
            className="text-button"
            onClick={() => setAdding(true)}
          >
            <Icon name="plus" size={14} />
            Sign in
          </button>
        )}
      </div>
      {status.handle && (
        <article className="workbench-entry mail-card">
          <header className="entry-head">
            <span className="entry-icon">
              <Icon name="butterfly" />
            </span>
            <div className="entry-heading">
              <strong>@{status.handle}</strong>
              <small>
                Following
                {status.fetchedAt
                  ? ` · ${relativeTime(status.fetchedAt)}`
                  : " · Reading…"}
              </small>
            </div>
            {status.error && <StatusChip status="error" />}
            <IconButton
              icon="arrows-clockwise"
              label="Read the timeline again"
              disabled={busy}
              onClick={() =>
                void api("feeds.bluesky.refresh").then(setStatus).catch(fail)
              }
            />
            <IconButton
              icon="sign-out"
              label="Sign out of Bluesky"
              onClick={() =>
                void api("feeds.bluesky.signOut").then(setStatus).catch(fail)
              }
            />
          </header>
          {status.error && <p className="error-text">{status.error}</p>}
          <ul className="bluesky-posts">
            {status.posts.slice(0, more ? 30 : 8).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="bluesky-post"
                  onClick={() => open(p.link)}
                >
                  <span className="bluesky-meta">
                    <b>{p.author}</b>
                    <small>
                      @{p.handle}
                      {p.at > 0 && ` · ${relativeTime(p.at)}`}
                      {p.note && ` · ${p.note}`}
                    </small>
                  </span>
                  <span className="bluesky-text">{p.text}</span>
                </button>
              </li>
            ))}
          </ul>
          {status.posts.length > 8 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setMore(!more)}
            >
              {more
                ? "Show fewer"
                : `Show ${Math.min(30, status.posts.length) - 8} more`}
            </button>
          )}
        </article>
      )}
      {adding && (
        <div className="workbench-entry mail-add">
          <div className="mail-add-row">
            <input
              aria-label="Bluesky handle"
              placeholder="you.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
            <input
              aria-label="Bluesky app password"
              type="password"
              placeholder="App password (xxxx-xxxx-xxxx-xxxx)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <p className="setting-note">
            Make an app password in Bluesky under Settings › Privacy and
            security › App passwords; never use your main password. Yami keeps
            only the sign-in, encrypted on this PC, and reads your Following
            timeline when the Inbox opens. It cannot post, like or follow.
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={busy || !handle.trim() || !password.trim()}
              onClick={signIn}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
