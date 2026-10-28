import { useEffect, useState } from "react";
import { api } from "../api";
import { useModules } from "../setup/use-modules";
import { Icon } from "../ui";

type Status = {
  installed: boolean;
  running: boolean;
  smtp: string;
  web: string;
};

/**
 * Dev › Projects: Mailpit as a local mail catcher. It is a pack (about
 * 11 MB), started and stopped here only, and listens on this PC alone.
 */
export function MailCatcher({ report }: { report: (m: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null),
    [busy, setBusy] = useState(false);
  const fail = (e: Error) => report(e.message);
  const pack = useModules(report)
    ?.find((m) => m.id === "workbench")
    ?.packs.find((p) => p.id === "mailpit");
  const load = () => void api("mailcatcher.status").then(setStatus).catch(fail);
  useEffect(load, [pack?.state]);
  if (!status) return null;
  const run = (method: string) => {
    setBusy(true);
    void api(method)
      .then(setStatus)
      .catch(fail)
      .finally(() => setBusy(false));
  };
  const downloading = pack?.state === "downloading" || pack?.state === "queued";
  return (
    <section className="mail-catcher">
      <h3 className="group-title">Mail catcher</h3>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Mailpit</strong>
            <p>
              {status.running
                ? `Catching mail sent to ${status.smtp}. Nothing leaves this PC.`
                : status.installed
                  ? `Point your app's SMTP at ${status.smtp} to catch its mail here instead of sending it.`
                  : "Catch the mail your app sends while you develop it: a local SMTP server and inbox, about 11 MB. Nothing is downloaded until you ask."}
            </p>
          </div>
          {!status.installed ? (
            <button
              className="soft-button"
              disabled={downloading}
              onClick={() =>
                void api("packs.install", { id: "mailpit" }).catch(fail)
              }
            >
              <Icon name="download-simple" size={16} />
              {downloading
                ? `Downloading ${pack?.bytes ? Math.round(((pack.received || 0) / pack.bytes) * 100) : 0}%`
                : "Download Mailpit"}
            </button>
          ) : status.running ? (
            <div className="task-new">
              <button
                className="soft-button"
                onClick={() =>
                  void api("open.external", { url: status.web }).catch(fail)
                }
              >
                <Icon name="envelope-open" size={16} />
                Open inbox
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => run("mailcatcher.stop")}
              >
                Stop
              </button>
            </div>
          ) : (
            <button
              className="soft-button"
              disabled={busy}
              onClick={() => run("mailcatcher.start")}
            >
              <Icon name="play" size={16} />
              Start
            </button>
          )}
        </div>
        {pack?.state === "failed" && (
          <div className="setting-row">
            <p>{pack.error || "The download did not finish."}</p>
          </div>
        )}
      </div>
    </section>
  );
}
