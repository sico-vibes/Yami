import { useState } from "react";
import { useWorkbench } from "./use-workbench";
import { Sessions, AgentApproval } from "./Sessions";
import { Usage } from "./Usage";
import { Connections } from "./Connections";
import { Dictation } from "./Dictation";
import { Notes } from "./Notes";
import { Recap } from "./Recap";
import { ContextView } from "./Context";
import { WorkspaceSettings } from "./WorkspaceSettings";
import { Mcp } from "./Mcp";
import { Projects } from "./Projects";
import { Icon } from "../ui";
import { Meter, relativeTime, StatusChip } from "../controls";
import { api } from "../api";
const pages = [
  ["Sessions", "robot"],
  ["Projects", "folders"],
  ["Usage", "chart-bar"],
  ["Connections", "plugs-connected"],
  ["Context", "paperclip"],
  ["Dictation", "microphone"],
  ["Notes", "note-pencil"],
  ["Recap", "calendar-blank"],
  ["MCP", "plug"],
  ["Workspace", "sliders-horizontal"],
];
export default function WorkbenchPage({
  report,
  compact = false,
  embedded = false,
  initial = "Sessions",
}: {
  report: (text: string) => void;
  compact?: boolean;
  embedded?: boolean;
  initial?: string;
}) {
  const data = useWorkbench(report),
    [page, setPage] = useState(initial);
  if (!data) return <div className="empty-state">Opening your workspace…</div>;
  const content =
    page === "Projects" ? (
      <Projects data={data} report={report} />
    ) : page === "Usage" ? (
      <Usage data={data} report={report} />
    ) : page === "Connections" ? (
      <Connections data={data} report={report} />
    ) : page === "Context" ? (
      <ContextView report={report} />
    ) : page === "Dictation" ? (
      <Dictation data={data} report={report} />
    ) : page === "Notes" ? (
      <Notes data={data} report={report} />
    ) : page === "Recap" ? (
      <Recap data={data} />
    ) : page === "Workspace" ? (
      <WorkspaceSettings data={data} report={report} />
    ) : page === "MCP" ? (
      <Mcp data={data} report={report} />
    ) : (
      <Sessions data={data} report={report} />
    );
  if (embedded) return content;
  return (
    <div
      className={
        compact ? "workbench-compact" : "settings-layout workbench-layout"
      }
    >
      {!compact && (
        <aside className="settings-sidebar">
          <h2>AI & workspace</h2>
          <nav aria-label="AI sections">
            {pages.map(([label, icon]) => (
              <button
                key={label}
                className={page === label ? "selected" : ""}
                aria-current={page === label ? "page" : undefined}
                onClick={() => {
                  if (
                    window.dispatchEvent(
                      new Event("yami-before-navigate", { cancelable: true }),
                    )
                  )
                    setPage(label);
                }}
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
          </nav>
        </aside>
      )}
      <section className={compact ? "" : "settings-content"} key={page}>
        {compact ? (
          <div className="drawer-ai">
            <section className="drawer-card drawer-ai-sessions">
              <h3>
                Agent activity
                <small>
                  {data.sessions.length
                    ? `${data.sessions.length} ${data.sessions.length === 1 ? "session" : "sessions"}`
                    : "Quiet"}
                </small>
              </h3>
              {data.sessions.length ? (
                <div className="drawer-ai-list">
                  {data.sessions
                    .slice(-5)
                    .reverse()
                    .map((s) => (
                      <div className="drawer-ai-row" key={s.id}>
                        <span className="entry-icon">
                          <Icon
                            name={
                              s.phase === "waiting" ? "hand" : "terminal-window"
                            }
                            size={16}
                          />
                        </span>
                        <div className="entry-heading">
                          <strong>{s.project}</strong>
                          <small>
                            {s.agent} · {s.detail} · {relativeTime(s.at)}
                          </small>
                        </div>
                        <StatusChip status={s.phase} />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="drawer-ai-empty">
                  <Icon name="robot" size={28} />
                  <p>
                    Connect your CLIs from the AI workspace to see activity
                    here.
                  </p>
                </div>
              )}
            </section>
            <div className="drawer-ai-side">
              <section className="drawer-card drawer-ai-actions">
                <button
                  className="primary-button"
                  onClick={() =>
                    void api("terminal.open").catch((e) => report(e.message))
                  }
                >
                  <Icon name="terminal-window" size={18} />
                  Open Yami Terminal
                </button>
                <button
                  className="soft-button"
                  onClick={() => void api("show", { tab: "ai" })}
                >
                  <Icon name="arrow-square-out" size={16} />
                  Open AI workspace
                </button>
              </section>
              <section className="drawer-card">
                <h3>Allowance</h3>
                {data.usage.some((r) => r.windows.length) ? (
                  data.usage
                    .flatMap((r) =>
                      r.windows.map((w) => ({ ...w, provider: r.provider })),
                    )
                    .slice(0, 3)
                    .map((w) => (
                      <div
                        className="drawer-meter"
                        key={w.provider + w.id + w.group}
                      >
                        <span>
                          {w.provider} · {w.label}
                          <b>
                            {w.used === null
                              ? "—"
                              : `${Math.round(w.used * 100)}%`}
                          </b>
                        </span>
                        <Meter
                          value={w.used}
                          label={`${w.provider} ${w.label} used`}
                        />
                      </div>
                    ))
                ) : (
                  <p className="setting-note">
                    Read your plan limits from Usage in the AI workspace.
                  </p>
                )}
              </section>
            </div>
          </div>
        ) : (
          content
        )}
      </section>
      {data.requests[0] && (
        <AgentApproval
          key={data.requests[0].id}
          request={data.requests[0]}
          report={report}
        />
      )}
    </div>
  );
}
