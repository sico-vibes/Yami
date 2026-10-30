import { useState } from "react";
import { api } from "../api";
import { Select } from "../controls";
import type { AgentCli, Worktree } from "../dev-types";
import { Icon, IconButton, Modal } from "../ui";
import { TaskCompare } from "./TaskCompare";

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
    [removing, setRemoving] = useState<Worktree | null>(null),
    [fanning, setFanning] = useState(false),
    [comparing, setComparing] = useState(false);
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
              type="button"
              className="soft-button"
              disabled={busy || !name.trim()}
              onClick={create}
            >
              <Icon name="git-branch" size={16} />
              {busy ? "Adding…" : "New task"}
            </button>
            <button
              type="button"
              className="soft-button"
              disabled={agents.filter((a) => a.prompt).length < 2}
              data-tip={
                agents.filter((a) => a.prompt).length < 2
                  ? "Fan out needs two installed agents that take a prompt"
                  : undefined
              }
              onClick={() => setFanning(true)}
            >
              <Icon name="tree-structure" size={16} />
              Fan out
            </button>
            {tasks.length >= 2 && (
              <button
                type="button"
                className="soft-button"
                onClick={() => setComparing(true)}
              >
                <Icon name="git-diff" size={16} />
                Compare
              </button>
            )}
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
      {comparing && (
        <TaskCompare
          project={project}
          tasks={tasks}
          onClose={() => setComparing(false)}
          report={report}
        />
      )}
      {fanning && (
        <FanOut
          project={project}
          agents={agents.filter((a) => a.prompt)}
          name={name}
          onClose={() => setFanning(false)}
          onStarted={(count) => {
            setFanning(false);
            setName("");
            load();
            report(`Started ${count} agents, each in its own worktree.`);
          }}
          report={report}
        />
      )}
      {removing && (
        <Modal title="Remove this task?" onClose={() => setRemoving(null)}>
          <p>
            The folder {removing.path} is removed. Its branch {removing.branch}{" "}
            stays, with every commit on it. Git refuses if the folder has
            changes that are not committed.
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() => setRemoving(null)}
            >
              Keep it
            </button>
            <button
              type="button"
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

/**
 * One task for several agents at once. Each gets a worktree on its own
 * branch and the task in a .yami-task.md file there, which its first prompt
 * points to, so the results can be compared side by side.
 */
function FanOut({
  project,
  agents,
  name: initialName,
  onClose,
  onStarted,
  report,
}: {
  project: { id: string; name: string };
  agents: AgentCli[];
  name: string;
  onClose: () => void;
  onStarted: (count: number) => void;
  report: (text: string) => void;
}) {
  const [name, setName] = useState(initialName),
    [prompt, setPrompt] = useState(""),
    [picked, setPicked] = useState<string[]>(
      agents.slice(0, 2).map((a) => a.id),
    ),
    [busy, setBusy] = useState(false);
  const toggle = (id: string) =>
    setPicked((now) =>
      now.includes(id)
        ? now.filter((p) => p !== id)
        : now.length < 4
          ? [...now, id]
          : now,
    );
  const ready = name.trim() && prompt.trim() && picked.length >= 2 && !busy;
  return (
    <Modal title={`Fan out in ${project.name}`} onClose={onClose}>
      <div className="fanout-form">
        <label>
          <span>Task name</span>
          <input
            autoFocus
            value={name}
            placeholder="e.g. fix login"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          <span>The task</span>
          <textarea
            rows={5}
            value={prompt}
            placeholder="What should each agent do?"
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        <div
          role="group"
          aria-label="Agents for the task"
          className="fanout-agents"
        >
          {agents.map((a) => (
            <button
              key={a.id}
              type="button"
              className={
                "file-chip" + (picked.includes(a.id) ? " selected" : "")
              }
              aria-pressed={picked.includes(a.id)}
              onClick={() => toggle(a.id)}
            >
              <Icon name="robot" size={14} />
              {a.name}
            </button>
          ))}
        </div>
        <p className="setting-note">
          Two to four agents. Each starts in its own folder on a{" "}
          <code>yami/&lt;task&gt;-&lt;agent&gt;</code> branch; your checkout is
          not touched. Remove the tasks here when you have picked a result.
        </p>
      </div>
      <div className="dialog-actions">
        <button type="button" className="soft-button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!ready}
          onClick={() => {
            setBusy(true);
            void api("dev.fanout", {
              id: project.id,
              name,
              prompt,
              agents: picked,
            })
              .then((started: unknown[]) => onStarted(started.length))
              .catch((e: Error) => report(e.message))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Starting…" : `Start ${picked.length} agents`}
        </button>
      </div>
    </Modal>
  );
}
