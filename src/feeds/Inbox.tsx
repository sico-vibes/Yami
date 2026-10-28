import { useEffect, useState } from "react";
import { api } from "../api";
import { relativeTime, Select, StatusChip } from "../controls";
import { feedKinds, type FeedKind, type FeedsView } from "../feeds-types";
import { Empty, Icon, IconButton } from "../ui";
import { MailGlance } from "./MailGlance";

/** Freshly read sources are not read again for this long when Desk opens. */
const freshFor = 10 * 60_000;

/** Desk › Inbox: feed items across sources, newest first. */
export default function Inbox({
  report,
}: {
  report: (message: string) => void;
}) {
  const [view, setView] = useState<FeedsView | null>(null),
    [kind, setKind] = useState<FeedKind>("reddit"),
    [value, setValue] = useState(""),
    [only, setOnly] = useState(""),
    [reading, setReading] = useState(false);
  const fail = (e: Error) => report(e.message);
  const refresh = (id?: string) => {
    setReading(true);
    return api("feeds.refresh", id ? { id } : {})
      .then(setView)
      .catch(fail)
      .finally(() => setReading(false));
  };
  // Show the cache at once, then read sources that are not fresh.
  useEffect(() => {
    void api("feeds.list")
      .then((cached: FeedsView) => {
        setView(cached);
        if (
          cached.status.some(
            (s) => !s.fetchedAt || Date.now() - s.fetchedAt > freshFor,
          )
        )
          void refresh();
      })
      .catch(fail);
  }, []);
  const spec = feedKinds.find((k) => k.kind === kind)!;
  const add = () =>
    void api("feeds.add", { kind, value })
      .then((source) => {
        setValue("");
        return refresh(source.id);
      })
      .catch(fail);
  const items = (view?.items || []).filter((i) => !only || i.source === only);
  const sourceName = (id: string) =>
    view?.sources.find((s) => s.id === id)?.name || "";
  return (
    <div className="plans-page inbox">
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p className="page-description">
            Feeds and mail, read when you look. Nothing is posted or sent.
          </p>
        </div>
        <IconButton
          icon="arrows-clockwise"
          label={reading ? "Reading feeds…" : "Read feeds again"}
          disabled={reading || !view?.sources.length}
          onClick={() => void refresh()}
        />
      </div>
      <MailGlance report={report} />
      <h3 className="group-title">Feeds</h3>
      <div className="inbox-add">
        <Select
          label="Feed type"
          value={kind}
          onChange={(k) => setKind(k as FeedKind)}
          options={feedKinds.map((k) => ({
            value: k.kind,
            label: k.label,
            icon: k.icon,
          }))}
        />
        {kind !== "hackernews" && (
          <input
            aria-label={spec.label}
            placeholder={spec.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && add()}
          />
        )}
        <button
          className="primary-button"
          disabled={kind !== "hackernews" && !value.trim()}
          onClick={add}
        >
          <Icon name="plus" />
          Add
        </button>
      </div>
      {!!view?.sources.length && (
        <div className="inbox-sources" role="group" aria-label="Show feed">
          <button
            className={"file-chip" + (only ? "" : " selected")}
            aria-pressed={!only}
            onClick={() => setOnly("")}
          >
            All
          </button>
          {view.sources.map((s) => {
            const status = view.status.find((x) => x.id === s.id);
            return (
              <span key={s.id} className="inbox-source">
                <button
                  className={"file-chip" + (only === s.id ? " selected" : "")}
                  aria-pressed={only === s.id}
                  data-tip={status?.error || s.url}
                  onClick={() => setOnly(only === s.id ? "" : s.id)}
                >
                  <Icon
                    name={feedKinds.find((k) => k.kind === s.kind)!.icon}
                    size={14}
                  />
                  {s.name}
                  {status?.state === "error" && (
                    <Icon name="warning" size={13} className="inbox-warn" />
                  )}
                </button>
                <IconButton
                  icon="x"
                  label={`Remove ${s.name}`}
                  onClick={() =>
                    void api("feeds.remove", { id: s.id })
                      .then((next) => {
                        setView(next);
                        if (only === s.id) setOnly("");
                      })
                      .catch(fail)
                  }
                />
              </span>
            );
          })}
        </div>
      )}
      {!view ? null : !view.sources.length ? (
        <Empty icon="rss" title="Add a feed to start your inbox">
          Try a subreddit, Hacker News or a GitHub repository's releases. Feeds
          are read when Desk opens, at most every ten minutes.
        </Empty>
      ) : !items.length ? (
        <Empty
          icon="tray"
          title={reading ? "Reading your feeds…" : "Nothing here yet"}
        >
          {view.status.find((s) => s.id === only)?.error ||
            "New items appear after the next read."}
        </Empty>
      ) : (
        <div className="inbox-list">
          {items.map((item) => (
            <a
              key={item.id}
              className="inbox-item"
              href={item.link}
              onClick={(e) => {
                e.preventDefault();
                void api("open.external", { url: item.link }).catch(fail);
              }}
            >
              <div className="inbox-meta">
                <span>{sourceName(item.source)}</span>
                {item.author && <span>{item.author}</span>}
                {item.at > 0 && <span>{relativeTime(item.at)}</span>}
              </div>
              <strong>{item.title}</strong>
              {item.summary && <p>{item.summary}</p>}
            </a>
          ))}
        </div>
      )}
      {reading && !!items.length && (
        <div className="inbox-reading">
          <StatusChip status="Reading" />
        </div>
      )}
    </div>
  );
}
