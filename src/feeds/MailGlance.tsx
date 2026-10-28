import { useEffect, useState } from "react";
import { api } from "../api";
import { relativeTime, Select, StatusChip } from "../controls";
import type { MailAccount } from "../feeds-types";
import { Icon, IconButton } from "../ui";

const providers = [
  { value: "gmail", label: "Gmail", icon: "envelope-simple" },
  { value: "fastmail", label: "Fastmail", icon: "envelope-simple" },
  { value: "icloud", label: "iCloud Mail", icon: "envelope-simple" },
  { value: "yahoo", label: "Yahoo Mail", icon: "envelope-simple" },
  { value: "custom", label: "Other IMAP server", icon: "envelope-simple" },
];
const web: Record<string, string> = {
  gmail: "https://mail.google.com/",
  fastmail: "https://app.fastmail.com/",
  icloud: "https://www.icloud.com/mail",
  yahoo: "https://mail.yahoo.com/",
};

/**
 * Unread count and newest subjects for each mail account, read when the
 * inbox opens. Read-only: Yami never marks, moves or sends mail.
 */
export function MailGlance({ report }: { report: (m: string) => void }) {
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null),
    [adding, setAdding] = useState(false),
    [provider, setProvider] = useState("gmail"),
    [host, setHost] = useState(""),
    [user, setUser] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("feeds.mail")
      .then((list: MailAccount[]) => {
        setAccounts(list);
        if (list.length)
          void api("feeds.mail.refresh").then(setAccounts).catch(fail);
      })
      .catch(fail);
  }, []);
  const add = () => {
    setBusy(true);
    void api("feeds.mail.add", { provider, host, user, password })
      .then((list) => {
        setAccounts(list);
        setAdding(false);
        setPassword("");
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  if (!accounts) return null;
  return (
    <section className="mail-glance">
      <div className="mail-head">
        <h3 className="group-title">Mail</h3>
        {!adding && (
          <button className="text-button" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} />
            Add mail
          </button>
        )}
      </div>
      {accounts.map((a) => (
        <article className="workbench-entry mail-card" key={a.id}>
          <header className="entry-head">
            <span className="entry-icon">
              <Icon name="envelope-simple" />
            </span>
            <div className="entry-heading">
              <strong>{a.user}</strong>
              <small>
                {a.glance
                  ? `${a.glance.unread} unread of ${a.glance.total}`
                  : "Reading…"}
                {a.checkedAt ? ` · ${relativeTime(a.checkedAt)}` : ""}
              </small>
            </div>
            {a.error && <StatusChip status="error" />}
            {web[a.provider] && (
              <IconButton
                icon="arrow-square-out"
                label={`Open ${a.user} in the browser`}
                onClick={() =>
                  void api("open.external", { url: web[a.provider] }).catch(
                    fail,
                  )
                }
              />
            )}
            <IconButton
              icon="x"
              label={`Remove ${a.user}`}
              onClick={() =>
                void api("feeds.mail.remove", { id: a.id })
                  .then(setAccounts)
                  .catch(fail)
              }
            />
          </header>
          {a.error && <p className="error-text">{a.error}</p>}
          {!!a.glance?.latest.length && (
            <ul className="mail-latest">
              {a.glance.latest.map((m, i) => (
                <li key={i}>
                  <b>{m.from}</b>
                  <span>{m.subject}</span>
                  {m.at > 0 && <small>{relativeTime(m.at)}</small>}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
      {adding && (
        <div className="workbench-entry mail-add">
          <div className="mail-add-row">
            <Select
              label="Mail provider"
              value={provider}
              onChange={setProvider}
              options={providers}
            />
            {provider === "custom" && (
              <input
                aria-label="IMAP server"
                placeholder="imap.example.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            )}
            <input
              aria-label="Mail address"
              placeholder="you@example.com"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
            <input
              aria-label="App password"
              type="password"
              placeholder="App password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <p className="setting-note">
            Use an app password from your mail account's security settings, not
            your normal password. It is kept encrypted on this PC. Yami opens
            INBOX read-only: nothing is marked as read, moved or sent, and no
            message body or image is loaded. Outlook.com needs Microsoft
            sign-in, which Yami does not support yet.
          </p>
          <div className="dialog-actions">
            <button className="soft-button" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={busy || !user.trim() || !password}
              onClick={add}
            >
              {busy ? "Checking…" : "Sign in and add"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
