import type { WorkbenchState } from "../workbench-types";
import { Empty } from "../ui";
export function Recap({ data }: { data: WorkbenchState }) {
  const recent = data.history.filter((e) => e.at > Date.now() - 7 * 86400000);
  const projects = [...new Set(recent.map((e) => e.project))];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your week with Yami</h1>
          <p className="page-description">
            Recorded agent events on this PC. No productivity score or invented
            time savings.
          </p>
        </div>
      </div>
      {!recent.length ? (
        <Empty icon="calendar-blank" title="Room for a little progress">
          Connected agents will leave a local activity summary here. Retention
          is configurable in Workspace.
        </Empty>
      ) : (
        <>
          <p className="setting-note">
            {recent.filter((e) => e.phase === "finished").length} completed-turn
            events · {new Set(recent.map((e) => e.session)).size} sessions ·{" "}
            {projects.length} projects
          </p>
          {projects.map((project) => (
            <section className="workbench-usage" key={project}>
              <h2>{project}</h2>
              {recent
                .filter((e) => e.project === project)
                .slice(-30)
                .reverse()
                .map((e, i) => (
                  <div className="workbench-quota" key={e.at + ":" + i}>
                    <span>{e.agent}</span>
                    <span>{e.phase}</span>
                    <small>{new Date(e.at).toLocaleString()}</small>
                  </div>
                ))}
            </section>
          ))}
        </>
      )}
    </>
  );
}
