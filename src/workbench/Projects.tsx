import { useEffect, useState } from "react";
import { api } from "../api";
import { relativeTime, StatusChip } from "../controls";
import {
  agentClis,
  type AgentCliId,
  type DetectedAgent,
  type Editor,
  type ProjectInfo,
} from "../dev-types";
import { Empty, Icon, IconButton } from "../ui";
import type { WorkbenchState } from "../workbench-types";

const editorNames: Record<Editor, string> = {
  vscode: "VS Code",
  cursor: "Cursor",
};

/** Project folders with one-click agents, git state and editor links. */
export function Projects({
  data,
  report,
}: {
  data: WorkbenchState;
  report: (text: string) => void;
}) {
  const [info, setInfo] = useState<ProjectInfo[] | null>(null),
    [agents, setAgents] = useState<DetectedAgent[]>([]),
    [editors, setEditors] = useState<Editor[]>([]),
    [suggested, setSuggested] = useState<string[]>([]),
    [reading, setReading] = useState(false);
  const fail = (e: Error) => report(e.message);
  const refresh = () => {
    setReading(true);
    void Promise.all([api("dev.projects"), api("dev.suggestions")])
      .then(([list, folders]) => {
        setInfo(list);
        setSuggested(folders);
      })
      .catch(fail)
      .finally(() => setReading(false));
  };
  // Git is read when the page opens or the list changes, never on a timer.
  const ids = data.projects.map((p) => p.id).join();
  useEffect(refresh, [ids]);
  useEffect(() => {
    void api("dev.agents").then(setAgents).catch(fail);
    void api("dev.editors")
      .then(setEditors)
      .catch(() => setEditors([]));
  }, []);
  const call = (method: string, args?: object) => api(method, args).catch(fail);
  const installed = agentClis.filter((c) => agents.some((a) => a.id === c.id));
  const launch = (project: ProjectInfo, agent?: AgentCliId) => {
    void call("dev.launch", { project: project.id, agent: agent ?? "" });
    if (agent && agent !== project.agent)
      void call("dev.projects.update", { id: project.id, agent });
  };
  const live = (id: string) => data.projects.find((p) => p.id === id);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="page-description">
            Your folders, one click from a terminal or an agent.
          </p>
        </div>
        <div className="workbench-actions">
          <IconButton
            icon="arrows-clockwise"
            label="Check folders and git again"
            onClick={() => {
              refresh();
              void api("dev.agents", { rescan: true })
                .then(setAgents)
                .catch(fail);
            }}
          />
          <button
            className="primary-button"
            onClick={() => void call("dev.projects.add")}
          >
            <Icon name="folder-plus" />
            Add project
          </button>
        </div>
      </div>
      <section className="agent-strip" aria-label="Coding agents on this PC">
        {installed.length ? (
          installed.map((cli) => (
            <span
              key={cli.id}
              className="agent-chip"
              data-tip={agents.find((a) => a.id === cli.id)?.path}
            >
              <span className="agent-mark" aria-hidden="true">
                {cli.mark}
              </span>
              {cli.name}
            </span>
          ))
        ) : (
          <span className="setting-note">
            No coding agent CLI was found on PATH, in npm, WinGet, Scoop, Bun or
            Cargo folders.
          </span>
        )}
      </section>
      {!!suggested.length && (
        <div className="project-suggestions">
          <span className="setting-note">Folders your agents worked in</span>
          {suggested.map((folder) => (
            <button
              key={folder}
              className="file-chip"
              data-tip={folder}
              onClick={() => void call("dev.projects.add", { path: folder })}
            >
              <Icon name="plus" size={14} />
              {folder.split(/[\\/]/).filter(Boolean).pop()}
            </button>
          ))}
        </div>
      )}
      {!data.projects.length ? (
        <Empty icon="folders" title="Add the folders you work in">
          Each project gets a terminal, your coding agents and its git status.
          Yami reads git only when this page opens.
        </Empty>
      ) : (
        <div className="workbench-list project-list">
          {(
            info ||
            data.projects.map((p): ProjectInfo => ({ ...p, exists: true }))
          )
            .filter((p) => live(p.id))
            .map((project) => {
              const p = { ...project, ...live(project.id) };
              const favourite = installed.find((c) => c.id === p.agent);
              return (
                <article className="workbench-entry project-card" key={p.id}>
                  <header className="entry-head">
                    <span className="entry-icon">
                      <Icon name={p.git ? "git-branch" : "folder"} />
                    </span>
                    <div className="entry-heading">
                      <strong>{p.name}</strong>
                      <small data-tip={p.path}>{p.path}</small>
                    </div>
                    {!p.exists && <StatusChip status="unavailable" />}
                    {p.activity && <StatusChip status={p.activity.phase} />}
                    <IconButton
                      icon="x"
                      label={`Forget ${p.name}`}
                      onClick={() =>
                        void call("dev.projects.remove", { id: p.id })
                      }
                    />
                  </header>
                  <div className="project-meta">
                    {p.git ? (
                      <>
                        <span className="value-pill">
                          <Icon name="git-branch" size={13} />
                          {p.git.branch || "no branch"}
                        </span>
                        <span className="value-pill">
                          {p.git.changes ? `${p.git.changes} changed` : "Clean"}
                        </span>
                        {!!(p.git.ahead || p.git.behind) && (
                          <span className="value-pill">
                            ↑{p.git.ahead} ↓{p.git.behind}
                          </span>
                        )}
                      </>
                    ) : (
                      p.exists &&
                      info && <span className="value-pill">Not a git repo</span>
                    )}
                    {p.activity && (
                      <span className="setting-note">
                        {agentClis.find((c) => c.id === p.activity!.agent)
                          ?.name || p.activity.agent}{" "}
                        · {relativeTime(p.activity.at)}
                      </span>
                    )}
                    {reading && !info && (
                      <span className="setting-note">Reading…</span>
                    )}
                  </div>
                  {!!installed.length && p.exists && (
                    <div
                      className="project-agents"
                      role="group"
                      aria-label={`Start an agent in ${p.name}`}
                    >
                      {installed.map((cli) => (
                        <button
                          key={cli.id}
                          className={
                            "agent-launch" +
                            (cli.id === p.agent ? " favourite" : "")
                          }
                          aria-label={`Start ${cli.name} in ${p.name}`}
                          data-tip={`Start ${cli.name} here`}
                          onClick={() => launch(p, cli.id)}
                        >
                          <span className="agent-mark" aria-hidden="true">
                            {cli.mark}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <footer className="entry-foot">
                    <button
                      className="text-button"
                      disabled={!p.exists}
                      onClick={() => launch(p)}
                    >
                      <Icon name="terminal-window" size={16} />
                      Terminal here
                    </button>
                    <button
                      className="text-button"
                      disabled={!p.exists}
                      onClick={() =>
                        void call("dev.open", { id: p.id, target: "explorer" })
                      }
                    >
                      <Icon name="folder-open" size={16} />
                      Explorer
                    </button>
                    {editors.map((editor) => (
                      <button
                        key={editor}
                        className="text-button"
                        disabled={!p.exists}
                        onClick={() =>
                          void call("dev.open", { id: p.id, target: editor })
                        }
                      >
                        <Icon name="code" size={16} />
                        {editorNames[editor]}
                      </button>
                    ))}
                    {favourite && (
                      <button
                        className="soft-button entry-action"
                        disabled={!p.exists}
                        onClick={() => launch(p, favourite.id)}
                      >
                        <Icon name="play" size={16} />
                        Start {favourite.name}
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
        </div>
      )}
    </>
  );
}
