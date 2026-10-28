import { useEffect, useState } from "react";
import { api } from "../api";
import { Select } from "../controls";
import { dnsProfiles, type DnsAdapter } from "../tune-types";
import { Modal, Toggle } from "../ui";

/** DNS per adapter: a fixed list of public resolvers, or back to automatic. */
export function DnsSection({ report }: { report: (m: string) => void }) {
  const [adapters, setAdapters] = useState<DnsAdapter[] | null>(null),
    [pending, setPending] = useState<{
      adapter: DnsAdapter;
      profile: string;
      encrypted: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("tune.dns").then(setAdapters).catch(fail);
  }, []);
  const profile = (id: string) => dnsProfiles.find((p) => p.id === id);
  const apply = () => {
    if (!pending) return;
    const { adapter, profile: id, encrypted } = pending;
    setPending(null);
    setBusy(true);
    void api("tune.dns.set", { index: adapter.index, profile: id, encrypted })
      .then((next: DnsAdapter[]) => {
        setAdapters(next);
        const now = next.find((a) => a.index === adapter.index);
        report(
          `${adapter.name} now uses ${profile(id)?.name || id} DNS${
            now?.encrypted ? ", encrypted" : ""
          }.`,
        );
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
          adapters.flatMap((a) => [
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
                  id !== a.profile &&
                  setPending({
                    adapter: a,
                    profile: id,
                    encrypted: a.encrypted && id !== "automatic",
                  })
                }
                options={dnsProfiles.map((p) => ({
                  value: p.id,
                  label: p.name,
                  icon: p.id === "automatic" ? "network" : "shield-check",
                }))}
              />
            </div>,
            profile(a.profile) && a.profile !== "automatic" && (
              <div className="setting-row" key={`${a.index}-doh`}>
                <div>
                  <strong>Encrypt {a.name} lookups</strong>
                  <p>
                    {a.encrypted
                      ? "DNS over HTTPS only: your network cannot read or change the lookups."
                      : "Uses Windows 11's DNS over HTTPS so your network cannot read or change the lookups."}
                  </p>
                </div>
                <Toggle
                  label={`Encrypt DNS for ${a.name}`}
                  value={a.encrypted}
                  disabled={busy}
                  onChange={(on) =>
                    setPending({
                      adapter: a,
                      profile: a.profile,
                      encrypted: on,
                    })
                  }
                />
              </div>
            ),
          ])
        )}
      </div>
      {busy && <p className="setting-note">Waiting for Windows…</p>}
      {pending && (
        <Modal
          title={
            pending.profile === pending.adapter.profile
              ? pending.encrypted
                ? "Encrypt DNS?"
                : "Stop encrypting DNS?"
              : "Change DNS?"
          }
          onClose={() => setPending(null)}
        >
          <p>
            {pending.adapter.name} will use{" "}
            <b>{profile(pending.profile)?.name}</b>
            {profile(pending.profile)?.servers.length
              ? ` (${profile(pending.profile)!.servers.join(", ")}). ${profile(pending.profile)!.detail}.`
              : ", the DNS your router hands out."}{" "}
            {pending.encrypted
              ? "Lookups go over HTTPS only, with no fallback to plain DNS; if the resolver is unreachable, websites stop loading until you switch back. "
              : ""}
            Windows asks for administrator approval next. You can switch back
            here any time.
          </p>
          <div className="dialog-actions">
            <button className="soft-button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="primary-button" onClick={apply}>
              {pending.profile === pending.adapter.profile
                ? pending.encrypted
                  ? "Encrypt"
                  : "Stop encrypting"
                : "Change DNS"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
