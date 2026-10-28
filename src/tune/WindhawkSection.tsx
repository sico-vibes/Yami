import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../ui";

type Info = {
  installed: boolean;
  mods: { id: string; name: string; version: string; disabled?: boolean }[];
  curated: { id: string; name: string }[];
};

const modPage = (id: string) => `https://windhawk.net/mods/${id}`;

/**
 * Explorer and taskbar mods through Windhawk. Mods run code inside Explorer,
 * which Yami itself never does, so Yami only shows what is installed, opens
 * Windhawk, and links to well-known mods.
 */
export function WindhawkSection({ report }: { report: (m: string) => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("bridges.windhawk").then(setInfo).catch(fail);
  }, []);
  if (!info) return null;
  const installed = new Set(info.mods.map((m) => m.id));
  const state = (m: Info["mods"][number]) =>
    [
      m.version && `Version ${m.version}`,
      m.disabled === true ? "Off" : m.disabled === false ? "On" : "",
    ]
      .filter(Boolean)
      .join(" · ") || m.id;
  return (
    <section>
      <h3 className="group-title">Explorer mods (Windhawk)</h3>
      <p className="setting-note">
        Windhawk changes how the taskbar, Start and Explorer look and behave
        with community mods. They run inside Explorer, so they are installed and
        switched in Windhawk itself; Yami shows them and links to them.
      </p>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Windhawk</strong>
            <p>
              {info.installed
                ? `${info.mods.length} mod${info.mods.length === 1 ? "" : "s"} installed`
                : "Not installed. Windhawk is free and open source."}
            </p>
          </div>
          {info.installed ? (
            <button
              className="soft-button"
              onClick={() => void api("bridges.windhawk.open").catch(fail)}
            >
              <Icon name="paint-brush" size={16} />
              Open Windhawk
            </button>
          ) : (
            <button
              className="soft-button"
              onClick={() =>
                void api("open.external", {
                  url: "https://windhawk.net/",
                }).catch(fail)
              }
            >
              <Icon name="arrow-square-out" size={16} />
              Get Windhawk
            </button>
          )}
        </div>
        {info.mods.map((m) => (
          <div className="setting-row" key={m.id}>
            <div>
              <strong>{m.name}</strong>
              <p>{state(m)}</p>
            </div>
            <button
              className="text-button"
              onClick={() =>
                void api("open.external", { url: modPage(m.id) }).catch(fail)
              }
            >
              Details
            </button>
          </div>
        ))}
        {info.curated
          .filter((m) => !installed.has(m.id))
          .map((m) => (
            <div className="setting-row" key={m.id}>
              <div>
                <strong>{m.name}</strong>
                <p>A popular mod, not installed.</p>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  void api("open.external", { url: modPage(m.id) }).catch(fail)
                }
              >
                View mod
              </button>
            </div>
          ))}
      </div>
    </section>
  );
}
