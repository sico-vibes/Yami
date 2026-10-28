import { useEffect, useState } from "react";
import { api } from "../api";
import { Save, ToolShell } from "./ToolShell";
import type { WheelFile } from "./types";

type Plan = {
  folders: number;
  count: number;
  moves: { from: string; to: string }[];
};

/**
 * Flatten one folder: every file in its subfolders moves up into it, and
 * the subfolders left empty go. The moves are listed before anything
 * happens; a clashing name gets " (2)" rather than replacing a file.
 */
export function FlattenTool({ files }: { files: WheelFile[] }) {
  const [plan, setPlan] = useState<Plan | null>(null),
    [note, setNote] = useState("");
  useEffect(() => {
    void api("wheel.flatten.plan")
      .then(setPlan)
      .catch((e: Error) => setNote(e.message));
  }, []);
  const folder = files[0]?.name || "this folder";
  return (
    <ToolShell title="Flatten" note={note}>
      <p className="tool-note">
        {!plan
          ? "Reading the folder…"
          : plan.count
            ? `${plan.count} file${plan.count === 1 ? "" : "s"} from ${plan.folders} subfolder${plan.folders === 1 ? "" : "s"} move into ${folder}. Subfolders left empty are removed; links are not followed.`
            : `${folder} has no files in subfolders.`}
      </p>
      {!!plan?.moves.length && (
        <ul className="rename-preview" aria-label="Moves">
          {plan.moves.map((m) => (
            <li key={m.from}>
              <span>{m.from}</span>
              <b>{m.to}</b>
            </li>
          ))}
          {plan.count > plan.moves.length && (
            <li>
              <span>…and {plan.count - plan.moves.length} more</span>
            </li>
          )}
        </ul>
      )}
      <Save
        label={plan?.count ? `Flatten ${plan.count} files` : "Flatten"}
        disabled={!plan?.count}
        onClick={() =>
          api("wheel.tool.apply", { tool: "tool:flatten" }).catch(
            (error: Error) => setNote(error.message),
          )
        }
      />
    </ToolShell>
  );
}
