import { useEffect, useState } from "react";
import { api } from "../api";
import { Save, ToolShell } from "./ToolShell";
import type { WheelFile } from "./types";

export function CompressTool({ files }: { files: WheelFile[] }) {
  const [preset, setPreset] = useState("balanced");
  const [percent, setPercent] = useState(100);
  const [targetMb, setTargetMb] = useState(0);
  const [note, setNote] = useState("");
  const visual = files.some((file) => /\.(png|jpe?g|webp|gif|mp4|mov|mkv|webm)$/i.test(file.name));
  return (
    <ToolShell title="Compress" note={note}>
      <div className="segmented">
        {[
          ["smaller", "Smaller"],
          ["balanced", "Balanced"],
          ["smallest", "Smallest"],
        ].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={preset === id} onClick={() => setPreset(id)}>
            {label}
          </button>
        ))}
      </div>
      {visual && (
        <label className="tool-row">
          Scale
          <input type="range" min={40} max={100} value={percent} aria-label="Scale" onChange={(event) => setPercent(Number(event.target.value))} />
          <span>{percent}%</span>
        </label>
      )}
      <label className="tool-row">
        Target
        <input type="number" min={0} value={targetMb || ""} placeholder="MB, optional" aria-label="Target size in megabytes" onChange={(event) => setTargetMb(Number(event.target.value))} />
        <span>MB</span>
      </label>
      <p className="tool-note">Video target size is used when ffprobe can read the duration. Other files are saved as a new zip.</p>
      <Save
        label="Save compressed copy"
        onClick={() => api("wheel.tool.apply", { tool: "tool:compress", preset, percent, targetMb }).catch((error: Error) => setNote(error.message))}
      />
    </ToolShell>
  );
}

export function MetadataTool({ files }: { files: WheelFile[] }) {
  const [fields, setFields] = useState<{ tag: string; value: string }[]>([]);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("EXIF:Artist");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!files[0] || files[0].path.startsWith("preview://")) {
      setFields([
        { tag: "EXIF:Artist", value: "Preview" },
        { tag: "EXIF:Copyright", value: "Example only" },
      ]);
      return;
    }
    void api("wheel.metadata", { path: files[0].path })
      .then(setFields)
      .catch((error: Error) => setNote(error.message));
  }, [files]);
  const shown = fields.filter((field) => field.tag.toLowerCase().includes(query.toLowerCase()));
  return (
    <ToolShell title="Details" note={note}>
      <input placeholder="Search fields" aria-label="Search metadata" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="field-list">
        {shown.slice(0, 40).map((field) => (
          <span key={field.tag}>
            {field.tag}: {field.value}
          </span>
        ))}
      </div>
      <label className="tool-row">
        Field
        <input aria-label="Metadata field" value={tag} onChange={(event) => setTag(event.target.value)} />
        <span />
      </label>
      <label className="tool-row">
        Value
        <input aria-label="Metadata value" value={value} onChange={(event) => setValue(event.target.value)} />
        <span />
      </label>
      <div className="tool-actions">
        <button type="button" onClick={() => void api("wheel.engines.install", { id: "exiftool" }).then(() => setNote("ExifTool is ready.")).catch((error: Error) => setNote(error.message))}>
          Download ExifTool
        </button>
        <button type="button" onClick={() => void api("wheel.tool.apply", { tool: "tool:metadata", edits: [{ tag, value }] }).catch((error: Error) => setNote(error.message))}>
          Save field
        </button>
        <button type="button" className="primary-button" onClick={() => void api("wheel.tool.apply", { tool: "tool:metadata", removeAll: true }).catch((error: Error) => setNote(error.message))}>
          Remove all
        </button>
      </div>
    </ToolShell>
  );
}

export function MergeTool({ files }: { files: WheelFile[] }) {
  const [order, setOrder] = useState(files.map((file) => file.path));
  const [note, setNote] = useState("");
  const move = (index: number, step: number) => {
    const next = [...order];
    const target = index + step;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };
  return (
    <ToolShell title="Merge" note={note}>
      {order.map((item, index) => (
        <div className="tool-row" key={item}>
          <span>{files.find((file) => file.path === item)?.name || item}</span>
          <span />
          <span>
            <button type="button" aria-label="Move earlier" onClick={() => move(index, -1)}>↑</button>
            <button type="button" aria-label="Move later" onClick={() => move(index, 1)}>↓</button>
          </span>
        </div>
      ))}
      <Save label="Save merged PDF" onClick={() => api("wheel.tool.apply", { tool: "tool:merge", order }).catch((error: Error) => setNote(error.message))} />
    </ToolShell>
  );
}

export function PendingTool({ title }: { title: string }) {
  return (
    <ToolShell title={title} note="">
      <p className="tool-note">This tool is listed on the wheel and is not connected in this build yet.</p>
    </ToolShell>
  );
}

