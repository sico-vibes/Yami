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
  { value: "outlook", label: "Outlook.com", icon: "microsoft-outlook-logo" },
  { value: "custom", label: "Other IMAP server", icon: "envelope-simple" },
];
const web: Record<string, string> = {
  gmail: "https://mail.google.com/",
  fastmail: "https://app.fastmail.com/",
  icloud: "https://www.icloud.com/mail",
  yahoo: "https://mail.yahoo.com/",
  outlook: "https://outlook.live.com/mail/",
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
    [busy, setBusy] = useState(false),
    [clientId, setClientId] = useState(""),
    // The Microsoft code to enter, while Yami waits for the sign-in.
    [code, setCode] = useState<{
      userCode: string;
      verificationUri: string;
    } | null>(null);
  const fail = (e: Error) => report(e.message);
  const microsoft = () => {
    setBusy(true);
    void api("feeds.mail.outlook.start", { clientId })
      .then((started) => {
        setCode(started);
        return api("feeds.mail.outlook.finish").then((list) => {
          setAccounts(list);
          setAdding(false);
        });
      })
      .catch((e) => {
        if (!/cancelled/i.test(e.message)) fail(e);
      })
      .finally(() => {
        setCode(null);
        setBusy(false);
      });
  };
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
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setAdding(true);
              void api("feeds.mail.outlook.clientId")
                .then(setClientId)
                .catch(() => {});
            }}
          >
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
            {provider === "outlook" ? (
              <input
                aria-label="Microsoft app (client) ID"
                placeholder="App (client) ID, 1a2b3c4d-…"
                value={clientId}
                disabled={busy}
                onChange={(e) => setClientId(e.target.value)}
              />
            ) : (
              <>
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
              </>
            )}
          </div>
          {code && (
            <div className="mail-code" role="status">
              <span>
                Go to <b>{code.verificationUri}</b> and enter
              </span>
              <strong className="mail-code-value">{code.userCode}</strong>
              <IconButton
                icon="copy"
                label="Copy the code"
                onClick={() =>
                  void navigator.clipboard.writeText(code.userCode).catch(fail)
                }
              />
              <button
                type="button"
                className="soft-button"
                onClick={() =>
                  void api("open.external", {
                    url: code.verificationUri,
                  }).catch(fail)
                }
              >
                <Icon name="arrow-square-out" size={14} />
                Open the page
              </button>
            </div>
          )}
          <p className="setting-note">
            {provider === "outlook"
              ? "Outlook.com signs in with Microsoft: you enter a short code in your browser, and Yami never sees your password. Microsoft asks for an app (client) ID: register a free app at entra.microsoft.com (App registrations, personal Microsoft accounts, Allow public client flows on) and paste its ID here. Yami keeps the sign-in encrypted on this PC and opens INBOX read-only."
              : "Use an app password from your mail account's security settings, not your normal password. It is kept encrypted on this PC. Yami opens INBOX read-only: nothing is marked as read, moved or sent, and no message body or image is loaded."}
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() => {
                if (code) void api("feeds.mail.outlook.cancel").catch(() => {});
                setAdding(false);
              }}
            >
              Cancel
            </button>
            {provider === "outlook" ? (
              <button
                type="button"
                className="primary-button"
                disabled={busy || !clientId.trim()}
                onClick={microsoft}
              >
                {code
                  ? "Waiting for Microsoft…"
                  : busy
                    ? "Starting…"
                    : "Sign in with Microsoft"}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                disabled={busy || !user.trim() || !password}
                onClick={add}
              >
                {busy ? "Checking…" : "Sign in and add"}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
