import { useEffect, useState } from "react";
import type { WorkbenchState } from "../workbench-types";
import { api } from "../api";
import { Icon, Toggle } from "../ui";
import { Meter, shortTime, StatusChip } from "../controls";
const names: Record<string, string> = {
  codex: "Codex",
  claude: "Claude",
  cursor: "Cursor",
  copilot: "GitHub Copilot",
  opencode: "OpenCode Go",
  grok: "Grok",
  custom: "Custom endpoint",
};
const providerName = (p: string) => names[p] || p;
const providerIcon = (p: string) =>
  p === "copilot" ? "github-logo" : p === "custom" ? "plugs" : "chart-bar";
export function Usage({
  data,
  report,
}: {
  data: WorkbenchState;
  report: (text: string) => void;
}) {
  const [busy, setBusy] = useState<string[]>([]);
  const [deadlineVersion, wake] = useState(0);
  useEffect(() => {
    const next = Math.min(
      ...data.usage.map((r) => r.retryAt || 0).filter((at) => at > Date.now()),
    );
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(
      () => wake((n) => n + 1),
      Math.min(2147483647, Math.max(1, next - Date.now() + 20)),
    );
    return () => clearTimeout(timer);
  }, [data.usage, busy, deadlineVersion]);
  const [customUrl, setCustomUrl] = useState(data.settings.customUsageUrl),
    [customKey, setCustomKey] = useState("");
  const patch = (a: any) =>
    void api("workbench.settings", a).catch((e) => report(e.message));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>AI allowance</h1>
          <p className="page-description">
            Published limits, kept separate from activity and API billing.
          </p>
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Allowance alerts</strong>
            <p>Notify at 90% used and on confirmed resets.</p>
          </div>
          <Toggle
            label="Allowance alerts"
            value={data.settings.usageAlerts}
            onChange={(value) => patch({ usageAlerts: value })}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Background refresh</strong>
            <p>
              Refresh previously connected quota readers every five minutes.
              Provider retry deadlines still apply.
            </p>
          </div>
          <Toggle
            label="Background quota refresh"
            value={data.settings.usageBackground}
            onChange={(value) => patch({ usageBackground: value })}
          />
        </div>
      </div>
      {(() => {
        const providers = [
          "codex",
          "claude",
          "cursor",
          "copilot",
          "opencode",
          "grok",
          ...(data.settings.customUsageUrl ? ["custom"] : []),
        ];
        const reading = (p: string) => data.usage.find((r) => r.provider === p);
        const read = (provider: string) => {
          setBusy((old) => [...old, provider]);
          void api("usage.refresh", { provider })
            .catch((e) => report(e.message))
            .finally(() => setBusy((old) => old.filter((p) => p !== provider)));
        };
        const refresh = (provider: string, compact = false) => {
          const r = reading(provider),
            waiting = !!r?.retryAt && r.retryAt > Date.now();
          return (
            <button
              className={compact ? "icon-button usage-read" : "soft-button"}
              aria-label={`Read ${providerName(provider)} usage`}
              data-tip={
                waiting
                  ? `Next reading after ${shortTime(r!.retryAt!, false)}`
                  : "Read signed-in usage"
              }
              disabled={busy.includes(provider) || waiting}
              onClick={() => read(provider)}
            >
              <Icon
                name={busy.includes(provider) ? "circle-notch" : "arrow-clockwise"}
                size={16}
              />
              {!compact && (busy.includes(provider) ? "Reading…" : "Read usage")}
            </button>
          );
        };
        const connected = providers.filter((p) => reading(p));
        const others = providers.filter((p) => !reading(p));
        return (
          <>
            {connected.map((provider) => {
              const r = reading(provider)!,
                groups = [...new Set(r.windows.map((w) => w.group || ""))];
              return (
                <section className="workbench-usage usage-card" key={provider}>
                  <header className="entry-head">
                    <span className="entry-icon">
                      <Icon name={providerIcon(provider)} />
                    </span>
                    <div className="entry-heading">
                      <strong>{providerName(provider)}</strong>
                      <small>{r.note || `${r.account} · ${r.source}`}</small>
                    </div>
                    <StatusChip status={r.status} />
                    {refresh(provider)}
                  </header>
                  {groups.map((group) => (
                    <div className="usage-group" key={group}>
                      {group && groups.length > 0 && <h3>{group}</h3>}
                      {r.windows
                        .filter((w) => (w.group || "") === group)
                        .map((w) => (
                          <div className="usage-window" key={w.id + w.group}>
                            <span className="usage-label">{w.label}</span>
                            <Meter
                              value={w.used}
                              label={`${w.label} used`}
                            />
                            <strong>
                              {w.used === null
                                ? "Unknown"
                                : `${Math.round(w.used * 100)}%`}
                            </strong>
                            <small>
                              {w.resetsAt
                                ? `Resets ${shortTime(w.resetsAt)}`
                                : "Reset time unavailable"}
                            </small>
                          </div>
                        ))}
                    </div>
                  ))}
                  {r.fetchedAt > 0 && (
                    <footer className="usage-foot">
                      <Icon name="clock" size={14} />
                      Last reading {shortTime(r.fetchedAt)}
                      {r.retryAt && r.retryAt > Date.now()
                        ? ` · Next refresh ${shortTime(r.retryAt, false)}`
                        : ""}
                    </footer>
                  )}
                </section>
              );
            })}
            {!!others.length && (
              <>
                <h3 className="group-title">Not read yet</h3>
                <p className="setting-note">
                  Uses each provider's installed client and sign-in. No
                  inference, sign-in or reset-credit action is triggered.
                </p>
                <div className="usage-grid">
                  {others.map((provider) => (
                    <div className="usage-tile" key={provider}>
                      <span className="entry-icon">
                        <Icon name={providerIcon(provider)} />
                      </span>
                      <strong>{providerName(provider)}</strong>
                      {refresh(provider, true)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}
      <h3 className="group-title">Custom usage endpoint</h3>
      <section className="workbench-usage">
        <p className="setting-note">
          A chat API is not automatically a quota API. Supports windows with id,
          label, usedPercent and resetsAt, or Claude-style utilization windows.
        </p>
        <div className="workbench-form">
          <label className="form-label">
            Usage URL
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://your-server.example/usage"
            />
          </label>
          <label className="form-label">
            Optional credential
            <input
              type="password"
              autoComplete="off"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
            />
          </label>
        </div>
        <button
          className="soft-button"
          disabled={!customUrl}
          onClick={() =>
            void api("workbench.settings", {
              customUsageUrl: customUrl,
              ...(customKey ? { usageKey: customKey } : {}),
            })
              .then(() => api("usage.refresh", { provider: "custom" }))
              .catch((e) => report(e.message))
          }
        >
          Save and read usage
        </button>
      </section>
    </>
  );
}
