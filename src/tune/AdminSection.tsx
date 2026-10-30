import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon, Modal, Toggle } from "../ui";

type Service = {
  name: string;
  label: string;
  start: string;
  running: boolean;
  savedStart?: string;
};

const explain: Record<string, string> = {
  DiagTrack:
    "Sends diagnostic and usage data to Microsoft in the background. Windows works the same without it.",
  MapsBroker: "Keeps offline maps up to date. Only the Maps app uses it.",
};

/**
 * Tune › Administrator: a restore point and two background services. Each
 * change asks first, then Windows asks for administrator approval once.
 */
export function AdminSection({ report }: { report: (m: string) => void }) {
  const [services, setServices] = useState<Service[] | null>(null),
    [pending, setPending] = useState<
      | { kind: "service"; service: Service; off: boolean }
      | { kind: "restore" }
      | null
    >(null),
    [busy, setBusy] = useState(false);
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("tune.admin").then(setServices).catch(fail);
  }, []);
  const run = () => {
    if (!pending) return;
    const step = pending;
    setPending(null);
    setBusy(true);
    const done =
      step.kind === "restore"
        ? api("tune.admin.restorePoint").then((r: { created: boolean }) =>
            report(
              r.created
                ? "Windows made a restore point."
                : "Windows already made a restore point in the last day, so it kept that one.",
            ),
          )
        : api("tune.admin.service", {
            name: step.service.name,
            off: step.off,
          }).then((next: Service[]) => {
            setServices(next);
            report(
              step.off
                ? `${step.service.label} is stopped and will not start again.`
                : `${step.service.label} is back to how it was.`,
            );
          });
    void done.catch(fail).finally(() => setBusy(false));
  };
  if (!services) return null;
  return (
    <section>
      <h3 className="group-title">Administrator</h3>
      <p className="setting-note">
        These need administrator rights, so Windows asks once for each change. A
        service Yami stops remembers how it was set, and switching it back
        restores exactly that.
      </p>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Make a restore point</strong>
            <p>A snapshot of system settings that Windows can roll back to.</p>
          </div>
          <button
            type="button"
            className="soft-button"
            disabled={busy}
            onClick={() => setPending({ kind: "restore" })}
          >
            <Icon name="clock-counter-clockwise" size={16} />
            Make one
          </button>
        </div>
        {services.map((s) => {
          const off = s.start === "Disabled";
          return (
            <div className="setting-row" key={s.name}>
              <div>
                <strong>Stop {s.label}</strong>
                <p>
                  {explain[s.name]}{" "}
                  {off
                    ? s.savedStart
                      ? `Stopped by Yami; it was ${s.savedStart.toLowerCase()}.`
                      : "It was already off before Yami."
                    : `Now ${s.start.toLowerCase()}${s.running ? " and running" : ""}.`}
                </p>
              </div>
              <Toggle
                label={`Stop ${s.label}`}
                value={off}
                disabled={busy || (off && !s.savedStart)}
                onChange={(next) =>
                  setPending({ kind: "service", service: s, off: next })
                }
              />
            </div>
          );
        })}
      </div>
      {busy && <p className="setting-note">Waiting for Windows…</p>}
      {pending && (
        <Modal
          title={
            pending.kind === "restore"
              ? "Make a restore point?"
              : pending.off
                ? `Stop ${pending.service.label}?`
                : `Turn ${pending.service.label} back on?`
          }
          onClose={() => setPending(null)}
        >
          <p>
            {pending.kind === "restore"
              ? "Windows saves a restore point named “Before changes in Yami Tune”. It can take a minute."
              : pending.off
                ? `The service stops now and is set not to start again. Yami keeps its current setting (${pending.service.start.toLowerCase()}) to put back later.`
                : `It goes back to ${(pending.service.savedStart || "manual").toLowerCase()}.`}{" "}
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
            <button type="button" className="primary-button" onClick={run}>
              Continue
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
