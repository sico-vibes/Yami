import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../api";
import { bangList, newTab } from "../browser-rules";
import { TooltipLayer } from "../controls";
import { Empty, Icon, IconButton } from "../ui";
import { FilterListsCard } from "./FilterListsCard";

type Tab = {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  canBack: boolean;
  canForward: boolean;
  discarded: boolean;
};
type Bookmark = { title: string; url: string; folder: string; from: string };

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** The Yami Browser window: tabs on the left, the page on the right. */
export default function BrowserApp() {
  const [tabs, setTabs] = useState<Tab[]>([]),
    [blocked, setBlocked] = useState(0),
    [blocking, setBlocking] = useState(true),
    [reading, setReading] = useState<{
      title: string;
      url: string;
      text: string;
    } | null>(null),
    [active, setActive] = useState(""),
    [driving, setDriving] = useState(""),
    [address, setAddress] = useState(""),
    [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  const page = useRef<HTMLDivElement>(null);
  const fail = (e: Error) => setError(e.message);
  const current = tabs.find((t) => t.id === active);
  useEffect(() => {
    const apply = (s: {
      tabs: Tab[];
      active: string;
      driving: string;
      blocked?: number;
    }) => {
      setTabs(s.tabs);
      setActive(s.active);
      setDriving(s.driving);
      setBlocked(s.blocked || 0);
    };
    void api("state")
      .then((st) => setBlocking(st.settings.browserBlocking))
      .catch(() => {});
    void api("browser.state").then(apply).catch(fail);
    return window.yami.on((e) => e.type === "browser-state" && apply(e as any));
  }, []);
  useEffect(() => {
    if (!editing)
      setAddress(current && current.url !== newTab ? current.url : "");
  }, [current?.url, active, editing]);
  // The page view is drawn by the main process over this box.
  useLayoutEffect(() => {
    const box = page.current;
    if (!box) return;
    // While the reader is open the page view steps aside (zero size).
    const send = () => {
      const r = box.getBoundingClientRect();
      void api("browser.layout", {
        x: r.left,
        y: r.top,
        width: reading ? 0 : r.width,
        height: reading ? 0 : r.height,
      });
    };
    send();
    const observer = new ResizeObserver(send);
    observer.observe(box);
    return () => observer.disconnect();
  }, [reading]);
  const go = (step: string) =>
    current && void api("browser.go", { id: current.id, step }).catch(fail);
  return (
    <div className="browser-shell">
      <TooltipLayer />
      <aside className="browser-rail" aria-label="Tabs">
        <div className="browser-brand">
          <Icon name="globe" />
          <span>Yami Browser</span>
        </div>
        <div className="browser-tabs" role="tablist" aria-label="Open tabs">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={"browser-tab" + (t.id === active ? " selected" : "")}
            >
              <button
                role="tab"
                aria-selected={t.id === active}
                onClick={() =>
                  void api("browser.select", { id: t.id }).catch(fail)
                }
              >
                <Icon
                  name={
                    t.loading
                      ? "circle-notch"
                      : t.url === newTab
                        ? "plus-circle"
                        : "globe-simple"
                  }
                  size={14}
                />
                <span>{t.title || host(t.url)}</span>
                {t.discarded && <small>asleep</small>}
              </button>
              <IconButton
                icon="x"
                label={`Close ${t.title}`}
                onClick={() =>
                  void api("browser.close", { id: t.id }).catch(fail)
                }
              />
            </div>
          ))}
        </div>
        <button
          className="text-button browser-new"
          onClick={() =>
            void api("browser.open", { input: newTab }).catch(fail)
          }
        >
          <Icon name="plus" size={14} />
          New tab
        </button>
      </aside>
      <main className="browser-main">
        <header className="browser-bar">
          <IconButton
            icon="arrow-left"
            label="Back"
            disabled={!current?.canBack}
            onClick={() => go("back")}
          />
          <IconButton
            icon="arrow-right"
            label="Forward"
            disabled={!current?.canForward}
            onClick={() => go("forward")}
          />
          <IconButton
            icon={current?.loading ? "x" : "arrow-clockwise"}
            label={current?.loading ? "Stop" : "Reload"}
            disabled={!current || current.url === newTab}
            onClick={() => go(current?.loading ? "stop" : "reload")}
          />
          <form
            className="browser-address"
            onSubmit={(e) => {
              e.preventDefault();
              if (!current) return;
              setEditing(false);
              void api("browser.navigate", {
                id: current.id,
                input: address,
              }).catch(fail);
            }}
          >
            <Icon
              name={
                current?.url.startsWith("https:")
                  ? "lock-simple"
                  : "magnifying-glass"
              }
              size={14}
            />
            <input
              aria-label="Address or search"
              placeholder={`Search or type an address · bangs like !${bangList.slice(0, 3).join(" !")}`}
              value={address}
              onFocus={(e) => {
                setEditing(true);
                e.currentTarget.select();
              }}
              onBlur={() => setEditing(false)}
              onChange={(e) => setAddress(e.target.value)}
            />
          </form>
          <IconButton
            icon="book-open-text"
            label={reading ? "Close the reader" : "Read this page"}
            active={!!reading}
            disabled={!current || current.url === newTab}
            onClick={() =>
              reading
                ? setReading(null)
                : void api("browser.reader").then(setReading).catch(fail)
            }
          />
          <button
            className={"browser-shield" + (blocking ? " on" : "")}
            aria-pressed={blocking}
            data-tip={
              blocking
                ? `Blocking known ads and trackers (${blocked} so far). Press to allow them.`
                : "Ads and trackers are allowed. Press to block them."
            }
            onClick={() =>
              void api("settings", { browserBlocking: !blocking })
                .then(() => setBlocking(!blocking))
                .catch(fail)
            }
          >
            <Icon name={blocking ? "shield-check" : "shield-slash"} size={16} />
            {blocking && blocked > 0 && <span>{blocked}</span>}
          </button>
          <div className="browser-window">
            <IconButton
              icon="minus"
              label="Minimize"
              onClick={() => void api("browser.window", { action: "minimize" })}
            />
            <IconButton
              icon="x"
              label="Close the browser"
              onClick={() => void api("browser.window", { action: "close" })}
            />
          </div>
        </header>
        {driving && (
          <div className="browser-driving" role="status">
            <Icon name="robot" size={14} />
            {driving}
          </div>
        )}
        {error && (
          <p
            className="browser-error"
            role="alert"
            onClick={() => setError("")}
          >
            {error}
          </p>
        )}
        <div className="browser-page" ref={page}>
          {reading && (
            <article className="browser-reader">
              <small>{host(reading.url)}</small>
              <h1>{reading.title}</h1>
              {reading.text
                .split(/\n{2,}|\n(?=[A-Z0-9“"])/)
                .map((p) => p.trim())
                .filter(Boolean)
                .slice(0, 400)
                .map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
            </article>
          )}
          {current?.url === newTab && (
            <NewTab
              open={(url) =>
                void api("browser.navigate", {
                  id: current.id,
                  input: url,
                }).catch(fail)
              }
              fail={fail}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function NewTab({
  open,
  fail,
}: {
  open: (url: string) => void;
  fail: (e: Error) => void;
}) {
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null),
    [sources, setSources] = useState<
      { id: string; name: string; found: boolean }[]
    >([]),
    [query, setQuery] = useState(""),
    [recent, setRecent] = useState<
      { url: string; title: string; at: number }[]
    >([]),
    [linked, setLinked] = useState<{
      browsers: { id: string; name: string }[];
      open: string;
    } | null>(null);
  const load = () => {
    void api("browser.linked")
      .then(setLinked)
      .catch(() => {});
    void api("browser.history")
      .then(setRecent)
      .catch(() => {});
    void api("vault.bookmarks").then(setBookmarks).catch(fail);
    void api("vault.sources")
      .then(setSources)
      .catch(() => {});
  };
  useEffect(load, []);
  const shown = (bookmarks || [])
    .filter((b) =>
      (b.title + " " + b.url + " " + b.folder)
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 60);
  return (
    <div className="browser-newtab">
      <h1>Where to?</h1>
      <p className="page-description">
        Type in the address bar above. Pages stay in this browser's own profile
        on your PC.
      </p>
      {!!linked?.browsers.length && (
        <section className="browser-linked">
          <strong>Signing in to Google or your bank?</strong>
          <p className="setting-note">
            Some sites refuse built-in browsers. Open one of your installed
            browsers with its own Yami profile instead. Your usual profile is
            not touched, and Yami's agent tools read that window while it is
            open.
          </p>
          <div className="browser-import">
            {linked.browsers.map((b) => (
              <button
                key={b.id}
                className="soft-button"
                onClick={() =>
                  void api("browser.linked.open", { id: b.id })
                    .then(load)
                    .catch(fail)
                }
              >
                <Icon name="arrow-square-out" size={16} />
                {linked.open === b.name
                  ? `${b.name} is open`
                  : `Open ${b.name}`}
              </button>
            ))}
            {linked.open && (
              <button
                className="text-button"
                onClick={() =>
                  void api("browser.linked.close").then(load).catch(fail)
                }
              >
                Close {linked.open}
              </button>
            )}
          </div>
        </section>
      )}
      <FilterListsCard fail={fail} />
      <div className="browser-import">
        {sources
          .filter((s) => s.found)
          .map((s) => (
            <button
              key={s.id}
              className="soft-button"
              onClick={() =>
                void api("vault.import", { id: s.id })
                  .then(() => load())
                  .catch(fail)
              }
            >
              <Icon name="download-simple" size={16} />
              Import {s.name} bookmarks
            </button>
          ))}
      </div>
      {recent.length > 0 && (
        <section className="browser-recent">
          <div className="mail-head">
            <h3 className="group-title">Recent</h3>
            <button
              className="text-button"
              onClick={() =>
                void api("browser.history.clear")
                  .then(() => setRecent([]))
                  .catch(fail)
              }
            >
              Clear
            </button>
          </div>
          <div className="browser-bookmarks">
            {recent.slice(0, 8).map((r) => (
              <button
                key={r.url}
                className="browser-bookmark"
                data-tip={r.url}
                onClick={() => open(r.url)}
              >
                <b>{r.title}</b>
                <small>{host(r.url)}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {bookmarks && bookmarks.length > 0 ? (
        <>
          <input
            className="browser-filter"
            aria-label="Find a bookmark"
            placeholder="Find a bookmark"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="browser-bookmarks">
            {shown.map((b) => (
              <button
                key={b.url}
                className="browser-bookmark"
                data-tip={b.url}
                onClick={() => open(b.url)}
              >
                <b>{b.title}</b>
                <small>
                  {host(b.url)}
                  {b.folder ? ` · ${b.folder}` : ""}
                </small>
              </button>
            ))}
          </div>
        </>
      ) : (
        bookmarks && (
          <Empty icon="bookmark-simple" title="No bookmarks yet">
            Import them from another browser on this PC. Only bookmarks are
            read; passwords and cookies are never touched.
          </Empty>
        )
      )}
    </div>
  );
}
