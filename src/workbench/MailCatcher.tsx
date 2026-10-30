import { useEffect, useState } from "react";
import { api } from "../api";
import { relativeTime } from "../controls";
import { Icon, IconButton, Modal } from "../ui";

type Status = { running: boolean; smtp: string; count: number };
type Mail = {
  id: string;
  from: string;
  to: string;
  subject: string;
  at: number;
  size: number;
};
type Opened = Mail & {
  date: string;
  text: string;
  attachments: { name: string; size: number }[];
};

/**
 * Dev › Projects: Yami's own mail catcher. A small SMTP server on this PC
 * that the user starts and stops here; caught mail is listed below it and
 * shown as text, so nothing in a message loads from the internet.
 */
export function MailCatcher({ report }: { report: (m: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null),
    [mail, setMail] = useState<Mail[]>([]),
    [open, setOpen] = useState<Opened | null>(null),
    [busy, setBusy] = useState(false);
  const fail = (e: Error) => report(e.message);
  const load = () => {
    void api("mailcatcher.status").then(setStatus).catch(fail);
    void api("mailcatcher.list").then(setMail).catch(fail);
  };
  useEffect(() => {
    load();
    return window.yami.on((e) => {
      if (e.type === "mailcatcher") load();
    });
  }, []);
  if (!status) return null;
  const toggle = () => {
    setBusy(true);
    void api(status.running ? "mailcatcher.stop" : "mailcatcher.start")
      .then(setStatus)
      .catch(fail)
      .finally(() => setBusy(false));
  };
  return (
    <section className="mail-catcher">
      <div className="mail-head">
        <h3 className="group-title">Mail catcher</h3>
        {mail.length > 0 && (
          <button
            type="button"
            className="text-button"
            onClick={() =>
              void api("mailcatcher.clear").then(setMail).catch(fail)
            }
          >
            Clear
          </button>
        )}
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Catch your app's mail</strong>
            <p>
              {status.running
                ? `Listening on ${status.smtp}. Point your app's SMTP there (no TLS, any login); mail stops here and is never sent on.`
                : `A small SMTP server on this PC for testing the mail your app sends. It runs only while started and keeps the newest 500 messages.`}
            </p>
          </div>
          <button
            type="button"
            className="soft-button"
            disabled={busy}
            onClick={toggle}
          >
            <Icon name={status.running ? "stop" : "play"} size={16} />
            {status.running ? "Stop" : "Start"}
          </button>
        </div>
        {mail.map((m) => (
          <div className="task-row mail-row" key={m.id}>
            <Icon name="envelope-simple" size={14} />
            <button
              type="button"
              className="mail-open"
              onClick={() =>
                void api("mailcatcher.read", { id: m.id })
                  .then(setOpen)
                  .catch(fail)
              }
            >
              <strong>{m.subject}</strong>
              <small>
                {m.from} → {m.to} · {relativeTime(m.at)}
              </small>
            </button>
            <IconButton
              icon="trash"
              label={`Delete ${m.subject}`}
              onClick={() =>
                void api("mailcatcher.remove", { id: m.id })
                  .then(setMail)
                  .catch(fail)
              }
            />
          </div>
        ))}
      </div>
      {open && (
        <Modal title={open.subject} onClose={() => setOpen(null)}>
          <dl className="mail-meta">
            <dt>From</dt>
            <dd>{open.from}</dd>
            <dt>To</dt>
            <dd>{open.to}</dd>
            {open.date && (
              <>
                <dt>Date</dt>
                <dd>{open.date}</dd>
              </>
            )}
          </dl>
          <pre className="mail-text">{open.text || "(no text)"}</pre>
          {open.attachments.length > 0 && (
            <p className="setting-note">
              Attachments:{" "}
              {open.attachments
                .map((a) => `${a.name} (${Math.ceil(a.size / 1024)} KB)`)
                .join(", ")}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() =>
                void api("mailcatcher.open", { id: open.id }).catch(fail)
              }
            >
              Open in mail app
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setOpen(null)}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
