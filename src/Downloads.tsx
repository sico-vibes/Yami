import { useEffect, useState } from "react";
import { api } from "./api";
import { Meter, Select, relativeTime } from "./controls";
import { bytesText } from "./tune/CleanupSection";
import { Icon, IconButton } from "./ui";
import { BrowserLinkCard } from "./BrowserLinkCard";

type Job = {
  id: string;
  url: string;
  name: string;
  size: number;
  received: number;
  state: "queued" | "downloading" | "paused" | "done" | "error";
  parts: unknown[];
  speed: number;
  error?: string;
  added: number;
  finished?: number;
  file?: string;
};
type View = {
  jobs: Job[];
  settings: { connections: number; active: number; folder: string };
};

const eta = (j: Job) => {
  if (!j.speed || !j.size) return "";
  const s = Math.round((j.size - j.received) / j.speed);
  return s < 60 ? `${s} s left` : `${Math.round(s / 60)} min left`;
};

/**
 * Desk › Downloads: Yami's own download manager. Paste a link, or download
 * in the Yami Browser or with the browser extension; big files come in
 * several parts at once and can be paused and resumed.
 */
export function Downloads({ report }: { report: (m: string) => void }) {
  const [view, setView] = useState<View | null>(null),
    [url, setUrl] = useState("");
  const fail = (e: Error) => report(e.message);
  const call = (method: string, args?: object) =>
    void api(method, args)
      .then((v) => v && typeof v === "object" && "jobs" in v && setView(v))
      .catch(fail);
  useEffect(() => {
    void api("downloads").then(setView).catch(fail);
    return window.yami.on((e) => {
      if (e.type === "downloads")
        setView((v) => (v ? { ...v, jobs: e.jobs } : v));
    });
  }, []);
  if (!view) return null;
  const active = view.jobs.filter((j) => j.state === "downloading");
  const total = active.reduce((n, j) => n + j.speed, 0);
  return (
    <div className="plans-page downloads-page">
      <div className="page-head">
        <div>
          <h1>Downloads</h1>
          <p className="page-description">
            {active.length
              ? `${active.length} downloading · ${bytesText(total)}/s`
              : "Paste a link, or download in the Yami Browser."}
          </p>
        </div>
        <IconButton
          icon="folder-open"
          label="Open the downloads folder"
          onClick={() => call("downloads.folder")}
        />
      </div>
      <div className="inbox-add">
        <input
          aria-label="Download link"
          placeholder="https://example.com/file.zip"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim()) {
              call("downloads.add", { url });
              setUrl("");
            }
          }}
        />
        <Select
          label="Connections per file"
          value={String(view.settings.connections)}
          onChange={(c) =>
            call("downloads.settings", { connections: Number(c) })
          }
          options={[1, 2, 4, 6, 8].map((n) => ({
            value: String(n),
            label: `${n} ${n === 1 ? "connection" : "connections"}`,
          }))}
        />
        <button
          className="primary-button"
          disabled={!url.trim()}
          onClick={() => {
            call("downloads.add", { url });
            setUrl("");
          }}
        >
          <Icon name="download-simple" />
          Download
        </button>
      </div>
      <p className="setting-note">Saved to {view.settings.folder}</p>
      {!view.jobs.length && (
        <p className="muted downloads-empty">Nothing downloaded yet.</p>
      )}
      <div className="downloads-list">
        {view.jobs.map((j) => {
          const share = j.size ? j.received / j.size : null;
          return (
            <article className={`download-row is-${j.state}`} key={j.id}>
              <Icon
                name={
                  j.state === "done"
                    ? "check-circle"
                    : j.state === "error"
                      ? "warning-circle"
                      : "download-simple"
                }
                size={22}
              />
              <div className="download-main">
                <strong data-tip={j.url}>
                  {j.name || new URL(j.url).hostname}
                </strong>
                {j.state !== "done" && (
                  <Meter value={share} label={`${j.name} progress`} />
                )}
                <small>
                  {j.state === "done"
                    ? `${bytesText(j.size)} · ${relativeTime(j.finished || j.added)}`
                    : j.state === "error"
                      ? j.error
                      : [
                          j.size
                            ? `${bytesText(j.received)} of ${bytesText(j.size)}`
                            : bytesText(j.received),
                          j.state === "downloading" &&
                            `${bytesText(j.speed)}/s`,
                          j.state === "downloading" && eta(j),
                          j.parts.length > 1 && `${j.parts.length} parts`,
                          j.state === "paused" && "Paused",
                          j.state === "queued" && "Waiting",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                </small>
              </div>
              <div className="setting-control">
                {j.state === "done" ? (
                  <>
                    <IconButton
                      icon="arrow-square-out"
                      label={`Open ${j.name}`}
                      onClick={() => call("downloads.open", { id: j.id })}
                    />
                    <IconButton
                      icon="folder-open"
                      label={`Show ${j.name} in Explorer`}
                      onClick={() => call("downloads.reveal", { id: j.id })}
                    />
                  </>
                ) : j.state === "downloading" || j.state === "queued" ? (
                  <IconButton
                    icon="pause"
                    label={`Pause ${j.name}`}
                    onClick={() => call("downloads.pause", { id: j.id })}
                  />
                ) : (
                  <IconButton
                    icon="play"
                    label={`Resume ${j.name}`}
                    onClick={() => call("downloads.resume", { id: j.id })}
                  />
                )}
                <IconButton
                  icon="x"
                  label={`Remove ${j.name} from the list`}
                  onClick={() => call("downloads.remove", { id: j.id })}
                />
              </div>
            </article>
          );
        })}
      </div>
      {view.jobs.some((j) => j.state === "done") && (
        <button className="text-button" onClick={() => call("downloads.clear")}>
          Clear finished
        </button>
      )}
      <BrowserLinkCard report={report} />
    </div>
  );
}
