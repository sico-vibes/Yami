import { useState } from "react";
import { api } from "../api";
import { Select } from "../controls";
import type { AgentCli, Worktree } from "../dev-types";
import { Icon, IconButton, Modal } from "../ui";

/**
 * Parallel tasks for one project: each is a git worktree on its own
 * `yami/<name>` branch with an agent running in it. Git is read only when
 * this list is opened.
 */
export function ProjectTasks({
  project,
  agents,
  report,
}: {
  project: { id: string; name: string; agent?: string };
  agents: AgentCli[];
  report: (text: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [trees, setTrees] = useState<Worktree[] | null>(null),
    [name, setName] = useState(""),
    [agent, setAgent] = useState(project.agent || ""),
    [busy, setBusy] = useState(false),
    [removing, setRemoving] = useState<Worktree | null>(null);
  const fail = (e: Error) => report(e.message);
  const load = () =>
    void api("dev.worktrees", { id: project.id }).then(setTrees).catch(fail);
  const tasks = (trees || []).filter((t) => !t.main);
  const create = () => {
    setBusy(true);
    void api("dev.task", { id: project.id, name, agent })
      .then(() => {
        setName("");
        load();
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  return (
    <div className="project-tasks">
      <button
        type="button"
        className="text-button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) load();
        }}
      >
        <Icon name={open ? "caret-up" : "caret-down"} size={14} />
        Parallel tasks{trees ? ` (${tasks.length})` : ""}
      </button>
      {open && (
        <>
          <div className="task-new">
            <input
              aria-label={`New task in ${project.name}`}
              placeholder="Task name, e.g. fix login"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && create()}
            />
            <Select
              label="Agent for the task"
              value={agent}
              onChange={setAgent}
              options={[
                { value: "", label: "Terminal only", icon: "terminal-window" },
                ...agents.map((a) => ({
                  value: a.id,
                  label: a.name,
                  icon: "robot",
                })),
              ]}
            />
            <button
              className="soft-button"
              disabled={busy || !name.trim()}
              onClick={create}
            >
              <Icon name="git-branch" size={16} />
              {busy ? "Adding…" : "New task"}
            </button>
          </div>
          {trees && !tasks.length && (
            <p className="setting-note">
              No tasks yet. Each task gets its own folder and branch, so agents
              can work side by side without touching your checkout.
            </p>
          )}
          {tasks.map((t) => (
            <div className="task-row" key={t.path}>
              <Icon name="git-branch" size={14} />
              <div>
                <strong>{t.branch || "detached"}</strong>
                <small data-tip={t.path}>{t.path}</small>
              </div>
              <IconButton
                icon="terminal-window"
                label={`Terminal in ${t.branch}`}
                onClick={() =>
                  void api("dev.launch", { cwd: t.path }).catch(fail)
                }
              />
              <IconButton
                icon="trash"
                label={`Remove ${t.branch}`}
                onClick={() => setRemoving(t)}
              />
            </div>
          ))}
        </>
      )}
      {removing && (
        <Modal title="Remove this task?" onClose={() => setRemoving(null)}>
          <p>
            The folder {removing.path} is removed. Its branch {removing.branch}{" "}
            stays, with every commit on it. Git refuses if the folder has
            changes that are not committed.
          </p>
          <div className="dialog-actions">
            <button className="soft-button" onClick={() => setRemoving(null)}>
              Keep it
            </button>
            <button
              className="primary-button"
              onClick={() => {
                const path = removing.path;
                setRemoving(null);
                void api("dev.task.remove", { id: project.id, path })
                  .then(setTrees)
                  .catch(fail);
              }}
            >
              Remove folder
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
