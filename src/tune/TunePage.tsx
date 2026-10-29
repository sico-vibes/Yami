import { useEffect, useState } from "react";
import { api } from "../api";
import { StatusChip } from "../controls";
import {
  tuneCategories,
  tweaks,
  type StartupApp,
  type TweakState,
} from "../tune-types";
import { Icon, Modal, Toggle } from "../ui";
import { DnsSection } from "./DnsSection";
import { ShieldSection } from "./ShieldSection";
import { AdminSection } from "./AdminSection";
import { AppsSection } from "./AppsSection";
import { CleanupSection } from "./CleanupSection";

const sourceLabel: Record<StartupApp["source"], string> = {
  user: "Your account",
  folder: "Startup folder",
  machine: "All users",
};

/** Windows tune-up: per-user tweaks with exact undo. */
export default function TunePage({
  report,
}: {
  report: (message: string) => void;
}) {
  const [states, setStates] = useState<TweakState[] | null>(null),
    [busy, setBusy] = useState(""),
    [restart, setRestart] = useState(false),
    [asking, setAsking] = useState(false),
    [startup, setStartup] = useState<StartupApp[] | null>(null),
    // Bumped when one DNS section changes an adapter, so the other reads it.
    [dnsKey, setDnsKey] = useState(0),
    [shieldKey, setShieldKey] = useState(0);
  useEffect(() => {
    void api("tune.list")
      .then(setStates)
      .catch((e) => report(e.message));
    void api("tune.startup")
      .then(setStartup)
      .catch((e) => report(e.message));
  }, []);
  const state = (id: string) => states?.find((s) => s.id === id);
  const change = (id: string, on: boolean) => {
    setBusy(id);
    void api(on ? "tune.apply" : "tune.undo", { ids: [id] })
      .then((next: TweakState[]) => {
        setStates(next);
        if (tweaks.find((t) => t.id === id)?.restartExplorer) setRestart(true);
      })
      .catch((e) => report(e.message))
      .finally(() => setBusy(""));
  };
  return (
    <div className="tune-page">
      <div className="page-head">
        <div>
          <h1>Tune</h1>
          <p className="page-description">
            Small Windows changes, each one undone exactly as it was.
          </p>
        </div>
      </div>
      <p className="setting-note">
        These change your own Windows settings only, with no administrator
        prompt. Before a change, Yami saves the earlier values, so turning a
        tweak off puts back what was there.
      </p>
      {restart && (
        <div className="tune-restart" role="status">
          <Icon name="arrows-clockwise" />
          <span>Some changes show after File Explorer restarts.</span>
          <button className="soft-button" onClick={() => setAsking(true)}>
            Restart Explorer
          </button>
        </div>
      )}
      {tuneCategories.map((category) => (
        <section key={category}>
          <h3 className="group-title">{category}</h3>
          <div className="setting-group">
            {tweaks
              .filter((t) => t.category === category)
              .map((t) => {
                const s = state(t.id);
                // Already set before Yami: there is nothing of ours to undo.
                const locked = !!s?.applied && !s.undoable;
                return (
                  <div className="setting-row" key={t.id}>
                    <div>
                      <strong>{t.name}</strong>
                      <p>
                        {t.detail}
                        {t.restartExplorer && " Shows after Explorer restarts."}
                      </p>
                    </div>
                    <div className="setting-control">
                      {locked && <StatusChip status="Already set" />}
                      <Toggle
                        label={t.name}
                        value={!!s?.applied}
                        disabled={!states || locked || busy === t.id}
                        onChange={(on) => change(t.id, on)}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
      <DnsSection
        key={dnsKey}
        report={report}
        onChange={() => setShieldKey((k) => k + 1)}
      />
      <ShieldSection
        report={report}
        dnsKey={shieldKey}
        onDns={() => setDnsKey((k) => k + 1)}
      />
      <AdminSection report={report} />
      <CleanupSection report={report} />
      <AppsSection report={report} />
      <section>
        <h3 className="group-title">Startup apps</h3>
        <p className="setting-note">
          Switching an app off works like Task Manager: the entry stays, it just
          does not start with Windows. All-users apps need administrator rights,
          so they are shown but not changed.
        </p>
        <div className="setting-group">
          {startup === null ? (
            <div className="setting-row">
              <p>Reading startup apps…</p>
            </div>
          ) : !startup.length ? (
            <div className="setting-row">
              <p>No apps start with Windows for your account.</p>
            </div>
          ) : (
            startup.map((app) => (
              <div className="setting-row" key={app.id}>
                <div className="startup-app">
                  <strong>{app.name}</strong>
                  <p data-tip={app.command}>
                    {sourceLabel[app.source]} · {app.command}
                  </p>
                </div>
                <div className="setting-control">
                  {!app.editable && <StatusChip status="Needs admin" />}
                  <Toggle
                    label={`Start ${app.name} with Windows`}
                    value={app.enabled}
                    disabled={!app.editable || busy === app.id}
                    onChange={(enabled) => {
                      setBusy(app.id);
                      void api("tune.startup.set", { id: app.id, enabled })
                        .then(setStartup)
                        .catch((e) => report(e.message))
                        .finally(() => setBusy(""));
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      {asking && (
        <Modal title="Restart File Explorer?" onClose={() => setAsking(false)}>
          <p>
            The taskbar and open Explorer windows close for a moment and come
            back. Files being copied in Explorer stop.
          </p>
          <div className="dialog-actions">
            <button className="soft-button" onClick={() => setAsking(false)}>
              Not now
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setAsking(false);
                setRestart(false);
                void api("tune.restartExplorer").catch((e) =>
                  report(e.message),
                );
              }}
            >
              Restart Explorer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
