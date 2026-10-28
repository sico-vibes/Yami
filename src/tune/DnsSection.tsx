import { useEffect, useState } from "react";
import { api } from "../api";
import { Select } from "../controls";
import { dnsProfiles, type DnsAdapter } from "../tune-types";
import { Modal } from "../ui";

/** DNS per adapter: a fixed list of public resolvers, or back to automatic. */
export function DnsSection({ report }: { report: (m: string) => void }) {
  const [adapters, setAdapters] = useState<DnsAdapter[] | null>(null),
    [pending, setPending] = useState<{
      adapter: DnsAdapter;
      profile: string;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("tune.dns").then(setAdapters).catch(fail);
  }, []);
  const profile = (id: string) => dnsProfiles.find((p) => p.id === id);
  const apply = () => {
    if (!pending) return;
    const { adapter, profile: id } = pending;
    setPending(null);
    setBusy(true);
    void api("tune.dns.set", { index: adapter.index, profile: id })
      .then((next) => {
        setAdapters(next);
        report(`${adapter.name} now uses ${profile(id)?.name || id} DNS.`);
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  return (
    <section>
      <h3 className="group-title">Network DNS</h3>
      <p className="setting-note">
        Choose who answers your PC's DNS lookups. Filtering resolvers block
        known malware, adult sites or ads for every app. Changing it asks
        Windows for administrator approval; Automatic goes back to your router.
      </p>
      <div className="setting-group">
        {adapters === null ? (
          <div className="setting-row">
            <p>Reading network adapters…</p>
          </div>
        ) : !adapters.length ? (
          <div className="setting-row">
            <p>No connected network adapter was found.</p>
          </div>
        ) : (
          adapters.map((a) => (
            <div className="setting-row" key={a.index}>
              <div>
                <strong>{a.name}</strong>
                <p>
                  {a.profile === "custom"
                    ? `Router or custom DNS: ${a.servers.join(", ") || "none"}`
                    : `${profile(a.profile)?.name}: ${a.servers.join(", ")}`}
                </p>
              </div>
              <Select
                label={`DNS for ${a.name}`}
                value={a.profile === "custom" ? "automatic" : a.profile}
                onChange={(id) =>
                  id !== a.profile && setPending({ adapter: a, profile: id })
                }
                options={dnsProfiles.map((p) => ({
                  value: p.id,
                  label: p.name,
                  icon: p.id === "automatic" ? "network" : "shield-check",
                }))}
              />
            </div>
          ))
        )}
      </div>
      {busy && <p className="setting-note">Waiting for Windows…</p>}
      {pending && (
        <Modal title="Change DNS?" onClose={() => setPending(null)}>
          <p>
            {pending.adapter.name} will use{" "}
            <b>{profile(pending.profile)?.name}</b>
            {profile(pending.profile)?.servers.length
              ? ` (${profile(pending.profile)!.servers.join(", ")}). ${profile(pending.profile)!.detail}.`
              : ", the DNS your router hands out."}{" "}
            Windows asks for administrator approval next. You can switch back
            here any time.
          </p>
          <div className="dialog-actions">
            <button className="soft-button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="primary-button" onClick={apply}>
              Change DNS
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
