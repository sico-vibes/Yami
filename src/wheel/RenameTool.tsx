import { useState } from "react";
import { api } from "../api";
import { renamePlan } from "./rename";
import { Save, ToolShell } from "./ToolShell";
import type { WheelFile } from "./types";

/** Batch rename: a pattern with {n} and {name}, previewed before saving. */
export function RenameTool({ files }: { files: WheelFile[] }) {
  const [pattern, setPattern] = useState("{name}-{n}");
  const [start, setStart] = useState(1);
  const [note, setNote] = useState("");
  let plan: { from: string; to: string }[] = [];
  let problem = "";
  try {
    plan = renamePlan(
      files.map((f) => f.name),
      pattern,
      start,
    );
  } catch (error) {
    problem = (error as Error).message;
  }
  return (
    <ToolShell title="Rename" note={note || problem}>
      <label className="tool-row">
        Pattern
        <input
          aria-label="Name pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        />
      </label>
      <label className="tool-row">
        Start at
        <input
          type="number"
          min={0}
          aria-label="First number"
          value={start}
          onChange={(e) => setStart(Number(e.target.value) || 0)}
        />
      </label>
      <p className="tool-note">
        {"{n}"} is the number, {"{name}"} the old name. Extensions stay as they
        are, in the order you selected the files.
      </p>
      <ul className="rename-preview" aria-label="New names">
        {plan.slice(0, 50).map((p) => (
          <li key={p.from}>
            <span>{p.from}</span>
            <b>{p.to}</b>
          </li>
        ))}
      </ul>
      <Save
        label={`Rename ${files.length} files`}
        disabled={!!problem}
        onClick={() =>
          api("wheel.tool.apply", {
            tool: "tool:rename",
            pattern,
            start,
          }).catch((error: Error) => setNote(error.message))
        }
      />
    </ToolShell>
  );
}
