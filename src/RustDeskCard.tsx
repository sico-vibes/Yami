import { useEffect, useState } from "react";
import { api } from "./api";
import { Icon } from "./ui";

type Info = {
  installed: boolean;
  id: string;
  idServer: string;
  relayServer: string;
  hasKey: boolean;
};

/**
 * Settings › Phone: RustDesk, for full remote desktop. Yami does not bundle
 * it (AGPL); it finds an installed copy, shows its ID and server, starts it,
 * and can hand it a server config string from your own RustDesk server.
 */
export function RustDeskCard({ report }: { report: (m: string) => void }) {
  const [info, setInfo] = useState<Info | null>(null),
    [config, setConfig] = useState("");
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("bridges.rustdesk").then(setInfo).catch(fail);
  }, []);
  if (!info) return null;
  const server = info.idServer
    ? `server ${info.idServer}` +
      (info.relayServer ? `, relay ${info.relayServer}` : "") +
      (info.hasKey ? ", key set" : "")
    : "RustDesk's public servers";
  return (
    <>
      <h3 className="group-title">Remote desktop</h3>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>RustDesk</strong>
            <p>
              {info.installed
                ? `${info.id ? `Your ID: ${info.id}` : "ID not saved yet"} · ${server}`
                : "Not installed. RustDesk is a free, open-source remote desktop you can point at your own server."}
            </p>
          </div>
          {info.installed ? (
            <button
              className="soft-button"
              onClick={() => void api("bridges.rustdesk.open").catch(fail)}
            >
              <Icon name="desktop" size={16} />
              Open RustDesk
            </button>
          ) : (
            <button
              className="soft-button"
              onClick={() =>
                void api("open.external", {
                  url: "https://rustdesk.com/",
                }).catch(fail)
              }
            >
              <Icon name="arrow-square-out" size={16} />
              Get RustDesk
            </button>
          )}
        </div>
        {info.installed && (
          <div className="setting-row">
            <div>
              <strong>Use your own server</strong>
              <p>
                Paste the config string from your RustDesk server's console or
                another PC's Network settings. RustDesk imports it with its own{" "}
                <code>--config</code> option.
              </p>
            </div>
            <div className="task-new">
              <input
                aria-label="RustDesk config string"
                placeholder="Config string"
                value={config}
                onChange={(e) => setConfig(e.target.value)}
              />
              <button
                className="soft-button"
                disabled={!config.trim()}
                onClick={() =>
                  void api("bridges.rustdesk.open", { config })
                    .then(() => {
                      setConfig("");
                      report("RustDesk opened with your server settings.");
                    })
                    .catch(fail)
                }
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
