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
import { Icon } from "../ui";
import { api } from "../api";
const pages = [
  ["Sessions", "robot"],
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
    page === "Usage" ? (
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
          <>
            <div className="workbench-entry-title">
              <strong>Agent activity</strong>
              <button
                className="text-button"
                onClick={() => void api("show", { tab: "ai" })}
              >
                Open AI workspace
              </button>
            </div>
            {data.sessions.length ? (
              data.sessions
                .slice(-5)
                .reverse()
                .map((s) => (
                  <div className="workbench-quota" key={s.id}>
                    <span>
                      {s.project}
                      <small>
                        {s.agent} · {s.detail}
                      </small>
                    </span>
                    <span className="workbench-state">{s.phase}</span>
                  </div>
                ))
            ) : (
              <p className="setting-note">
                Connect your CLIs from the AI workspace to see activity here.
              </p>
            )}
            <button
              className="soft-button"
              onClick={() =>
                void api("terminal.open").catch((e) => report(e.message))
              }
            >
              Open Yami Terminal
            </button>
          </>
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
