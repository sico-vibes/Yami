import { useEffect, useState } from "react";
import type { WorkbenchState } from "../workbench-types";
import { api } from "../api";
import { Icon, Toggle } from "../ui";
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
      {[
        "codex",
        "claude",
        "cursor",
        "copilot",
        "opencode",
        "grok",
        ...(data.settings.customUsageUrl ? ["custom"] : []),
      ].map((provider) => {
        const r = data.usage.find((r) => r.provider === provider);
        return (
          <section className="workbench-usage" key={provider}>
            <div className="workbench-entry-title">
              <Icon name="chart-bar" />
              <h2>{provider === "opencode" ? "OpenCode Go" : provider}</h2>
              <span className="workbench-state">
                {r?.status || "Not connected"}
              </span>
              <button
                className="soft-button"
                disabled={
                  busy.includes(provider) ||
                  (!!r?.retryAt && r.retryAt > Date.now())
                }
                onClick={() => {
                  setBusy((old) => [...old, provider]);
                  void api("usage.refresh", { provider })
                    .catch((e) => report(e.message))
                    .finally(() =>
                      setBusy((old) => old.filter((p) => p !== provider)),
                    );
                }}
              >
                {busy.includes(provider) ? "Reading…" : "Read signed-in usage"}
              </button>
            </div>
            {r ? (
              <>
                <p className="setting-note">
                  {r.note || `${r.account} · ${r.source}`}
                </p>
                {r.windows.map((w) => (
                  <div className="workbench-quota" key={w.id + w.group}>
                    <span>
                      {w.group && `${w.group} · `}
                      {w.label}
                    </span>
                    <strong>
                      {w.used === null
                        ? "Unknown"
                        : `${Math.round(w.used * 100)}% used`}
                    </strong>
                    <small>
                      {w.resetsAt
                        ? `Resets ${new Date(w.resetsAt).toLocaleString()}`
                        : "Reset time unavailable"}
                    </small>
                  </div>
                ))}
                {r.fetchedAt > 0 && (
                  <small>
                    Last reading {new Date(r.fetchedAt).toLocaleString()}
                    {r.retryAt && r.retryAt > Date.now()
                      ? ` · Next refresh ${new Date(r.retryAt).toLocaleTimeString()}`
                      : ""}
                  </small>
                )}
              </>
            ) : (
              <p className="setting-note">
                Uses this provider's installed client and sign-in. No inference,
                sign-in or reset-credit action is triggered.
              </p>
            )}
          </section>
        );
      })}
      <section className="workbench-usage">
        <h2>Custom usage endpoint</h2>
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
