import type { WorkbenchState } from "../workbench-types";
import { Empty, Icon } from "../ui";
import { shortTime, StatusChip, statusTone } from "../controls";
export function Recap({ data }: { data: WorkbenchState }) {
  const recent = data.history.filter((e) => e.at > Date.now() - 7 * 86400000);
  const projects = [...new Set(recent.map((e) => e.project))];
  const stats: [string, number, string][] = [
    ["check-circle", recent.filter((e) => e.phase === "finished").length, "completed-turn events"],
    ["terminal-window", new Set(recent.map((e) => e.session)).size, "sessions"],
    ["folder-simple", projects.length, "projects"],
  ];
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
          <div className="stat-tiles">
            {stats.map(([icon, value, label]) => (
              <div className="stat-tile" key={label}>
                <Icon name={icon} />
                <b>{value}</b>
                <small>{label}</small>
              </div>
            ))}
          </div>
          {projects.map((project) => {
            const events = recent
              .filter((e) => e.project === project)
              .slice(-30)
              .reverse();
            return (
              <section className="workbench-usage recap-card" key={project}>
                <header className="entry-head">
                  <span className="entry-icon">
                    <Icon name="folder-simple" />
                  </span>
                  <div className="entry-heading">
                    <strong>{project}</strong>
                    <small>
                      {events.length} recent{" "}
                      {events.length === 1 ? "event" : "events"}
                    </small>
                  </div>
                </header>
                <ol className="timeline">
                  {events.map((e, i) => (
                    <li key={e.at + ":" + i} data-tone={statusTone(e.phase)}>
                      <span className="timeline-agent">{e.agent}</span>
                      <StatusChip status={e.phase} />
                      <time dateTime={new Date(e.at).toISOString()}>
                        {shortTime(e.at)}
                      </time>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
