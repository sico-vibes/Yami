import { useEffect, useState } from "react";
import { api } from "../api";
import type { Worktree } from "../dev-types";
import { Icon, Modal } from "../ui";

type Changed = {
  file: string;
  added: number;
  removed: number;
  untracked?: boolean;
};
type Column = {
  path: string;
  branch: string;
  files: Changed[];
  added: number;
  removed: number;
};

/** One line of a unified diff, coloured the way Nightglow marks changes. */
function DiffLine({ line }: { line: string }) {
  const kind = /^(\+\+\+|---|diff |index |new file)/.test(line)
    ? "meta"
    : line.startsWith("@@")
      ? "hunk"
      : line.startsWith("+")
        ? "add"
        : line.startsWith("-")
          ? "del"
          : "";
  return <span className={"diff-line " + kind}>{line || " "}</span>;
}

/**
 * Parallel tasks side by side: what each agent's worktree changed against
 * your checkout, and one file's diff in every task that touched it.
 */
export function TaskCompare({
  project,
  tasks,
  onClose,
  report,
}: {
  project: { id: string; name: string };
  tasks: Worktree[];
  onClose: () => void;
  report: (text: string) => void;
}) {
  const [picked, setPicked] = useState(tasks.slice(0, 4).map((t) => t.path)),
    [columns, setColumns] = useState<Column[] | null>(null),
    [file, setFile] = useState(""),
    [diffs, setDiffs] = useState<Record<string, string>>({});
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    setColumns(null);
    setFile("");
    if (picked.length < 2) return;
    void api("dev.compare", { id: project.id, paths: picked })
      .then(setColumns)
      .catch(fail);
  }, [picked.join("|")]);
  const open = (name: string) => {
    setFile(name);
    setDiffs({});
    for (const c of columns || [])
      if (c.files.some((f) => f.file === name))
        void api("dev.compare.file", {
          id: project.id,
          path: c.path,
          file: name,
        })
          .then((text: string) => setDiffs((d) => ({ ...d, [c.path]: text })))
          .catch(fail);
  };
  const toggle = (p: string) =>
    setPicked((now) =>
      now.includes(p)
        ? now.filter((x) => x !== p)
        : now.length < 4
          ? [...now, p]
          : now,
    );
  return (
    <Modal
      title={`Compare tasks in ${project.name}`}
      onClose={onClose}
      className="compare-modal"
      portal
    >
      <div role="group" aria-label="Tasks to compare" className="fanout-agents">
        {tasks.map((t) => (
          <button
            key={t.path}
            type="button"
            className={
              "file-chip" + (picked.includes(t.path) ? " selected" : "")
            }
            aria-pressed={picked.includes(t.path)}
            onClick={() => toggle(t.path)}
          >
            <Icon name="git-branch" size={14} />
            {t.branch}
          </button>
        ))}
      </div>
      {picked.length < 2 ? (
        <p className="setting-note">Choose two to four tasks.</p>
      ) : !columns ? (
        <p className="setting-note">Reading what each task changed…</p>
      ) : (
        <div
          className="compare-grid"
          style={{ "--cols": columns.length } as React.CSSProperties}
        >
          {columns.map((c) => (
            <section key={c.path} className="compare-col">
              <header>
                <strong>{c.branch}</strong>
                <small>
                  {c.files.length} file{c.files.length === 1 ? "" : "s"} ·{" "}
                  <span className="diff-add-count">+{c.added}</span>{" "}
                  <span className="diff-del-count">−{c.removed}</span>
                </small>
              </header>
              {!c.files.length && (
                <p className="setting-note">No changes yet.</p>
              )}
              <ul>
                {c.files.map((f) => (
                  <li key={f.file}>
                    <button
                      type="button"
                      className={
                        "compare-file" + (file === f.file ? " selected" : "")
                      }
                      onClick={() => open(f.file)}
                    >
                      <span>{f.file}</span>
                      <small>
                        {f.untracked ? "new · " : ""}+{f.added} −{f.removed}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
              {file && (
                <pre
                  className="compare-diff"
                  aria-label={`${file} in ${c.branch}`}
                >
                  {c.files.some((f) => f.file === file)
                    ? (diffs[c.path] ?? "Loading…")
                        .split("\n")
                        .map((line, i) => <DiffLine key={i} line={line} />)
                    : "This task did not change this file."}
                </pre>
              )}
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}
