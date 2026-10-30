import { useState } from "react";
import { api } from "../api";
import { Icon, IconButton, Modal, Toggle } from "../ui";

type Entry = { line: number; ip: string; names: string[]; on: boolean };
type Hosts = { entries: Entry[]; changed: boolean };

/**
 * Tune › Hosts file: names Windows answers itself before DNS. Reading is
 * free; each change shows one administrator prompt. Put back restores the
 * file as it was before Yami.
 */
export function HostsSection({ report }: { report: (m: string) => void }) {
  const [hosts, setHosts] = useState<Hosts | null>(null),
    [ip, setIp] = useState("0.0.0.0"),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [removing, setRemoving] = useState<Entry | null>(null);
  const call = (method: string, args?: object) => {
    setBusy(true);
    void api(method, args)
      .then((next: Hosts) => {
        setHosts(next);
        if (method === "tune.hosts.add") setName("");
      })
      .catch((e) => report(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <section>
      <h3 className="group-title">Hosts file</h3>
      <p className="setting-note">
        Names Windows answers itself before asking DNS, for every app. Point a
        name at 0.0.0.0 to block it, or at an address to reach a test server.
        Each change asks Windows for administrator approval.
      </p>
      <div className="setting-group">
        {hosts === null ? (
          <div className="setting-row">
            <div>
              <strong>Show the hosts file</strong>
              <p>Reads it; nothing changes until you do.</p>
            </div>
            <button
              type="button"
              className="soft-button"
              onClick={() => call("tune.hosts")}
            >
              <Icon name="list-bullets" size={16} />
              Show entries
            </button>
          </div>
        ) : (
          <>
            {!hosts.entries.length && (
              <div className="setting-row">
                <p>No entries yet; Windows uses DNS for every name.</p>
              </div>
            )}
            {hosts.entries.map((e) => (
              <div className="setting-row" key={e.line}>
                <div className="startup-app">
                  <strong>{e.names.join(", ")}</strong>
                  <p>
                    {e.ip === "0.0.0.0" || e.ip === "::" ? "Blocked" : e.ip}
                  </p>
                </div>
                <div className="setting-control">
                  <Toggle
                    label={`Use ${e.names[0]}`}
                    value={e.on}
                    disabled={busy}
                    onChange={(on) =>
                      call("tune.hosts.toggle", { line: e.line, on })
                    }
                  />
                  <IconButton
                    icon="trash"
                    label={`Remove ${e.names[0]}`}
                    onClick={() => setRemoving(e)}
                  />
                </div>
              </div>
            ))}
            <div className="setting-row">
              <div className="env-add">
                <input
                  aria-label="Address"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                />
                <input
                  aria-label="Host name"
                  placeholder="ads.example.com"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  type="button"
                  className="soft-button"
                  disabled={busy || !name.trim()}
                  onClick={() => call("tune.hosts.add", { ip, name })}
                >
                  <Icon name="plus" size={16} />
                  Add
                </button>
              </div>
            </div>
            {hosts.changed && (
              <div className="setting-row">
                <div>
                  <strong>Put back</strong>
                  <p>
                    Restores the hosts file as it was before Yami changed it.
                  </p>
                </div>
                <button
                  type="button"
                  className="soft-button"
                  disabled={busy}
                  onClick={() => call("tune.hosts.restore")}
                >
                  <Icon name="arrow-counter-clockwise" size={16} />
                  Put back
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {busy && <p className="setting-note">Waiting for Windows…</p>}
      {removing && (
        <Modal
          title={`Remove ${removing.names.join(", ")}?`}
          onClose={() => setRemoving(null)}
        >
          <p>
            Windows asks DNS for{" "}
            {removing.names.length > 1 ? "these names" : "this name"} again.
            Switching it off keeps the line; Put back restores the whole file.
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() => setRemoving(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="soft-button danger"
              onClick={() => {
                call("tune.hosts.remove", { line: removing.line });
                setRemoving(null);
              }}
            >
              Remove
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
