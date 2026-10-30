import { useEffect, useState } from "react";
import { api } from "../api";
import { Select, StatusChip } from "../controls";
import {
  shieldUpstreams,
  type DnsAdapter,
  type ShieldStatus,
} from "../tune-types";
import { Icon, Modal, Toggle } from "../ui";

const when = (at: number) =>
  at ? `Updated ${new Date(at).toLocaleDateString()}` : "Not downloaded yet";

/**
 * Tune › Network shield: Yami answers this PC's DNS itself, blocking names
 * on the chosen lists for every app, and shows what it blocked.
 */
export function ShieldSection({
  report,
  dnsKey,
  onDns,
}: {
  report: (m: string) => void;
  /** Changes when Network DNS changed an adapter. */
  dnsKey: number;
  /** Tells Network DNS that this section changed an adapter. */
  onDns: () => void;
}) {
  const [status, setStatus] = useState<ShieldStatus | null>(null),
    [adapters, setAdapters] = useState<DnsAdapter[]>([]),
    [pending, setPending] = useState<{
      adapter: DnsAdapter;
      use: boolean;
    } | null>(null),
    [domain, setDomain] = useState(""),
    [busy, setBusy] = useState(false);
  const fail = (e: Error) => report(e.message);
  const call = (method: string, args?: object) =>
    api(method, args).then(setStatus).catch(fail);
  useEffect(() => {
    void call("tune.shield");
  }, []);
  useEffect(() => {
    void api("tune.dns").then(setAdapters).catch(fail);
  }, [dnsKey]);
  // While on, the counts move; read them again while the page is open.
  useEffect(() => {
    if (!status?.running && !status?.updating) return;
    const timer = setInterval(() => void call("tune.shield"), 5000);
    return () => clearInterval(timer);
  }, [status?.running, status?.updating]);
  if (!status) return null;
  const s = status.stats,
    using = adapters.filter((a) => a.profile === "yami");
  const point = () => {
    if (!pending) return;
    const { adapter, use } = pending;
    setPending(null);
    setBusy(true);
    void api("tune.dns.set", {
      index: adapter.index,
      profile: use ? "yami" : "automatic",
    })
      .then((next: DnsAdapter[]) => {
        setAdapters(next);
        onDns();
        report(
          use
            ? `${adapter.name} now looks names up through the shield.`
            : `${adapter.name} is back to your router's DNS.`,
        );
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  const rule = (name: string, kind: "allow" | "block" | "none") =>
    void api("tune.shield.rule", { domain: name, kind })
      .then((next: ShieldStatus) => {
        setStatus(next);
        setDomain("");
      })
      .catch(fail);
  return (
    <section>
      <h3 className="group-title">Network shield</h3>
      <p className="setting-note">
        Yami answers this PC's DNS lookups itself and blocks names on the lists
        below, so ads, trackers and malware fail to load in every app and
        browser. Other lookups go to{" "}
        {shieldUpstreams.find((u) => u.id === status.upstream)?.name},
        encrypted. Yami keeps counts on this PC, never a history.
      </p>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Network shield</strong>
            <p>
              {status.error
                ? status.error
                : status.running
                  ? using.length
                    ? `Answering for ${using.map((a) => a.name).join(", ")}.`
                    : "Running. Point a network adapter at it below."
                  : "Off. Nothing listens and nothing is blocked."}
            </p>
          </div>
          <div className="setting-control">
            {status.updating && <StatusChip status="Downloading lists" />}
            <Toggle
              label="Network shield"
              value={status.on}
              onChange={(on) => void call("tune.shield.set", { on })}
            />
          </div>
        </div>
        {adapters
          .filter((a) => status.on || a.profile === "yami")
          .map((a) => {
            const on = a.profile === "yami";
            return (
              <div className="setting-row" key={a.index}>
                <div>
                  <strong>{a.name}</strong>
                  <p>
                    {on
                      ? status.on
                        ? "Uses the shield."
                        : "Still points at the shield, so Quad9 answers instead while it is off."
                      : "Does not use the shield yet."}
                  </p>
                </div>
                <button
                  type="button"
                  className="soft-button"
                  disabled={busy}
                  onClick={() => setPending({ adapter: a, use: !on })}
                >
                  <Icon
                    name={on ? "arrow-counter-clockwise" : "shield-check"}
                    size={16}
                  />
                  {on ? "Back to automatic" : `Use on ${a.name}`}
                </button>
              </div>
            );
          })}
        <div className="setting-row">
          <div>
            <strong>Resolver for everything else</strong>
            <p>Asked over DNS over HTTPS, so your network cannot read it.</p>
          </div>
          <Select
            label="Resolver for the shield"
            value={status.upstream}
            onChange={(upstream) => void call("tune.shield.set", { upstream })}
            options={shieldUpstreams.map((u) => ({
              value: u.id,
              label: u.name,
            }))}
          />
        </div>
        {status.lists.map((l) => (
          <div className="setting-row" key={l.id}>
            <div>
              <strong>{l.name}</strong>
              <p>
                {l.detail}.{" "}
                {l.rules ? `${l.rules.toLocaleString()} names, ` : ""}
                {when(l.updated)}. {l.licence}.
              </p>
            </div>
            <Toggle
              label={`Use ${l.name}`}
              value={l.enabled}
              onChange={(enabled) =>
                void call("tune.shield.set", { list: l.id, enabled })
              }
            />
          </div>
        ))}
        <div className="setting-row">
          <div>
            <strong>Update the lists</strong>
            <p>They also refresh by themselves once they are a week old.</p>
          </div>
          <button
            type="button"
            className="soft-button"
            disabled={status.updating}
            onClick={() => void call("tune.shield.update")}
          >
            <Icon name="arrows-clockwise" size={16} />
            {status.updating ? "Downloading…" : "Update"}
          </button>
        </div>
      </div>
      {s.queries > 0 && (
        <>
          <div className="usage-strip shield-stats">
            <div>
              <b>{s.queries.toLocaleString()}</b>
              <span>lookups</span>
            </div>
            <div>
              <b>{s.blocked.toLocaleString()}</b>
              <span>blocked</span>
            </div>
            <div>
              <b>{Math.round((s.blocked / s.queries) * 100)}%</b>
              <span>blocked share</span>
            </div>
            <div>
              <b>
                {s.hours.reduce((n, h) => n + h.blocked, 0).toLocaleString()}
              </b>
              <span>blocked in 24 hours</span>
            </div>
          </div>
          <div className="shield-columns">
            <DomainList
              title="Most blocked"
              rows={s.topBlocked}
              action="Allow"
              onAction={(d) => rule(d, "allow")}
            />
            <DomainList
              title="Most looked up"
              rows={s.topAsked}
              action="Block"
              onAction={(d) => rule(d, "block")}
            />
          </div>
          <h4 className="shield-subtitle">Latest lookups</h4>
          <div className="setting-group shield-recent">
            {s.recent.slice(0, 15).map((r, i) => (
              <div className="setting-row" key={`${r.at}-${i}`}>
                <div className="startup-app">
                  <strong>{r.name}</strong>
                  <p>
                    {r.type} · {new Date(r.at).toLocaleTimeString()}
                    {r.blocked ? ` · blocked by ${listName(status, r.by)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => rule(r.name, r.blocked ? "allow" : "block")}
                >
                  {r.blocked ? "Allow" : "Block"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <h4 className="shield-subtitle">Your rules</h4>
      <div className="setting-group">
        <div className="setting-row apps-search">
          <label className="search-field">
            <Icon name="globe" size={18} />
            <input
              placeholder="A domain, such as ads.example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="soft-button"
            disabled={!domain.trim()}
            onClick={() => rule(domain, "allow")}
          >
            Always allow
          </button>
          <button
            type="button"
            className="soft-button"
            disabled={!domain.trim()}
            onClick={() => rule(domain, "block")}
          >
            Always block
          </button>
        </div>
        {[
          ...status.allow.map((d) => [d, "Always allowed"]),
          ...status.block.map((d) => [d, "Always blocked"]),
        ].map(([d, kind]) => (
          <div className="setting-row" key={d}>
            <div>
              <strong>{d}</strong>
              <p>{kind}, and every name under it.</p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => rule(d, "none")}
            >
              Remove
            </button>
          </div>
        ))}
        {s.queries > 0 && (
          <div className="setting-row">
            <div>
              <strong>Reset the counts</strong>
              <p>Counting since {new Date(s.since).toLocaleDateString()}.</p>
            </div>
            <button
              type="button"
              className="soft-button"
              onClick={() => void call("tune.shield.reset")}
            >
              Reset
            </button>
          </div>
        )}
      </div>
      {busy && <p className="setting-note">Waiting for Windows…</p>}
      {pending && (
        <Modal
          title={
            pending.use
              ? `Use the shield on ${pending.adapter.name}?`
              : `Stop using the shield on ${pending.adapter.name}?`
          }
          onClose={() => setPending(null)}
        >
          <p>
            {pending.use
              ? `${pending.adapter.name}'s DNS becomes Yami on this PC (127.0.0.1 and ::1), with Quad9 (9.9.9.9) answering whenever Yami is not running, so the internet keeps working. Names on your router's network, such as printer names, may stop resolving.`
              : `${pending.adapter.name} goes back to the DNS your router hands out.`}{" "}
            Windows asks for administrator approval next.
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={point}>
              {pending.use ? "Use the shield" : "Back to automatic"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

const listName = (status: ShieldStatus, by?: string) =>
  status.lists.find((l) => l.id === by)?.name || by || "a list";

function DomainList({
  title,
  rows,
  action,
  onAction,
}: {
  title: string;
  rows: [string, number][];
  action: string;
  onAction: (domain: string) => void;
}) {
  return (
    <div>
      <h4 className="shield-subtitle">{title}</h4>
      <div className="setting-group">
        {!rows.length && (
          <div className="setting-row">
            <p>Nothing yet.</p>
          </div>
        )}
        {rows.map(([d, n]) => (
          <div className="setting-row" key={d}>
            <div className="startup-app">
              <strong>{d}</strong>
              <p>{n.toLocaleString()} times</p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onAction(d)}
            >
              {action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
