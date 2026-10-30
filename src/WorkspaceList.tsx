import { useEffect, useState } from "react";
import { api } from "./api";
import { relativeTime } from "./controls";
import { Icon, IconButton } from "./ui";

type Workspace = { id: string; name: string; at: number; windows: unknown[] };

/**
 * Controls card: save the open app windows and where they sit, then put
 * them back later; closed apps start again.
 */
export function WorkspaceList({ report }: { report: (m: string) => void }) {
  const [list, setList] = useState<Workspace[]>([]),
    [busy, setBusy] = useState("");
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("workspaces")
      .then(setList)
      .catch(() => {});
  }, []);
  const restore = (w: Workspace) => {
    setBusy(w.id);
    void api("workspaces.restore", { id: w.id })
      .then((r: { moved: number; started: number; missing: string[] }) =>
        report(
          `${w.name}: ${r.moved} moved, ${r.started} started${
            r.missing.length ? `; not restored: ${r.missing.join(", ")}` : ""
          }.`,
        ),
      )
      .catch(fail)
      .finally(() => setBusy(""));
  };
  return (
    <div className="workspace-list">
      <div className="workspace-head">
        <span>Workspaces</span>
        <button
          type="button"
          className="text-button"
          disabled={!!busy}
          onClick={() =>
            void api("workspaces.save", {})
              .then((next: Workspace[]) => {
                setList(next);
                report(
                  `Saved ${next[0].windows.length} windows as ${next[0].name}.`,
                );
              })
              .catch(fail)
          }
        >
          <Icon name="floppy-disk" size={14} />
          Save open windows
        </button>
      </div>
      {list.map((w) => (
        <div className="workspace-row" key={w.id}>
          <div>
            <b>{w.name}</b>
            <small>
              {w.windows.length} windows · {relativeTime(w.at)}
            </small>
          </div>
          <button
            type="button"
            className="soft-button"
            disabled={!!busy}
            onClick={() => restore(w)}
          >
            {busy === w.id ? "Restoring…" : "Restore"}
          </button>
          <IconButton
            icon="x"
            label={`Forget ${w.name}`}
            onClick={() =>
              void api("workspaces.remove", { id: w.id })
                .then(setList)
                .catch(fail)
            }
          />
        </div>
      ))}
    </div>
  );
}
