import { useState } from "react";
import { api } from "../api";
import { Save, ToolShell } from "./ToolShell";
import type { WheelFile } from "./types";

function apply(
  tool: string,
  options: Record<string, unknown>,
  setNote: (note: string) => void,
) {
  return api("wheel.tool.apply", { tool, ...options }).catch((error: Error) =>
    setNote(error.message),
  );
}

export function TrimTool({ files }: { files: WheelFile[] }) {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(5);
  const [silence, setSilence] = useState(false);
  const [note, setNote] = useState("");
  const audio = files.some((file) =>
    /\.(mp3|m4a|wav|flac|ogg|opus|aiff|wma)$/i.test(file.name),
  );
  return (
    <ToolShell
      title="Trim"
      note={note || "Saves a new copy beside the original."}
    >
      {audio && (
        <label className="tool-row">
          Silence
          <input
            type="checkbox"
            checked={silence}
            aria-label="Trim silence"
            onChange={(event) => setSilence(event.target.checked)}
          />
          <span>{silence ? "On" : "Off"}</span>
        </label>
      )}
      <Time label="Start" value={start} onChange={setStart} />
      <Time label="End" value={end} onChange={setEnd} />
      <Save
        label="Save trimmed copy"
        onClick={() => apply("tool:trim", { start, end, silence }, setNote)}
      />
    </ToolShell>
  );
}

export function VideoCropTool() {
  const [box, setBox] = useState({ x: 0, y: 0, w: 640, h: 360 });
  const [note, setNote] = useState("");
  const set = (key: keyof typeof box, value: number) =>
    setBox({ ...box, [key]: value });
  return (
    <ToolShell
      title="Crop video"
      note={note || "Pixels are measured from the top left of the picture."}
    >
      {(["x", "y", "w", "h"] as const).map((key) => (
        <label className="tool-row" key={key}>
          {key.toUpperCase()}
          <input
            type="number"
            min={0}
            aria-label={key}
            value={box[key]}
            onChange={(event) => set(key, Number(event.target.value))}
          />
          <span>px</span>
        </label>
      ))}
      <Save
        label="Save cropped copy"
        onClick={() => apply("tool:video-crop", box, setNote)}
      />
    </ToolShell>
  );
}

export function SpeedTool() {
  const [rate, setRate] = useState(1.5);
  const [note, setNote] = useState("");
  return (
    <ToolShell
      title="Speed"
      note={note || "Pitch stays with the picture. The range is 0.5× to 2×."}
    >
      <label className="tool-row">
        Rate
        <input
          type="range"
          min={50}
          max={200}
          value={Math.round(rate * 100)}
          aria-label="Speed"
          onChange={(event) => setRate(Number(event.target.value) / 100)}
        />
        <span>{rate.toFixed(2)}×</span>
      </label>
      <Save
        label="Save speed copy"
        onClick={() => apply("tool:speed", { rate }, setNote)}
      />
    </ToolShell>
  );
}

export function JoinTool({ files }: { files: WheelFile[] }) {
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
    <ToolShell
      title="Join"
      note={
        note ||
        "Files are copied together in this order. Mixed sizes can fail in ffmpeg."
      }
    >
      {order.map((item, index) => (
        <div className="tool-row" key={item}>
          <span>{files.find((file) => file.path === item)?.name || item}</span>
          <span />
          <span>
            <button
              type="button"
              aria-label="Move earlier"
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move later"
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
          </span>
        </div>
      ))}
      <Save
        label="Save joined copy"
        onClick={() => apply("tool:join", { order }, setNote)}
      />
    </ToolShell>
  );
}

export function SnapTool() {
  const [every, setEvery] = useState(1);
  const [note, setNote] = useState("");
  return (
    <ToolShell
      title="Snapshots"
      note={note || "PNG frames land in a new folder."}
    >
      <Time label="Every" value={every} onChange={setEvery} />
      <Save
        label="Save snapshots"
        onClick={() => apply("tool:snapshots", { every }, setNote)}
      />
    </ToolShell>
  );
}

export function SplitTool() {
  const [every, setEvery] = useState(10);
  const [note, setNote] = useState("");
  return (
    <ToolShell
      title="Split"
      note={note || "Clips are copied, so each cut lands on a nearby keyframe."}
    >
      <Time label="Length" value={every} onChange={setEvery} />
      <Save
        label="Save clips"
        onClick={() => apply("tool:split", { every }, setNote)}
      />
    </ToolShell>
  );
}

export function VideoRedactTool() {
  const [box, setBox] = useState({
    x: 40,
    y: 40,
    w: 200,
    h: 80,
    start: 0,
    end: 2,
    mode: "solid",
  });
  const [note, setNote] = useState("");
  return (
    <ToolShell
      title="Redact video"
      note={
        note ||
        "One box for this pass. Blur covers that rectangle only while it is on screen."
      }
    >
      {(["x", "y", "w", "h", "start", "end"] as const).map((key) => (
        <label className="tool-row" key={key}>
          {key}
          <input
            type="number"
            min={0}
            aria-label={key}
            value={box[key]}
            onChange={(event) =>
              setBox({ ...box, [key]: Number(event.target.value) })
            }
          />
          <span />
        </label>
      ))}
      <div className="segmented">
        <button
          type="button"
          aria-pressed={box.mode === "solid"}
          onClick={() => setBox({ ...box, mode: "solid" })}
        >
          Cover
        </button>
        <button
          type="button"
          aria-pressed={box.mode === "blur"}
          onClick={() => setBox({ ...box, mode: "blur" })}
        >
          Blur
        </button>
      </div>
      <Save
        label="Save redacted copy"
        onClick={() => apply("tool:video-redact", { boxes: [box] }, setNote)}
      />
    </ToolShell>
  );
}

export function NormalizeTool() {
  const [i, setI] = useState(-16);
  const [lra, setLra] = useState(11);
  const [tp, setTp] = useState(-1.5);
  const [note, setNote] = useState("");
  return (
    <ToolShell
      title="Normalize"
      note={
        note ||
        "ffmpeg measures the file first, then writes a new copy with loudnorm."
      }
    >
      <Time label="LUFS" value={i} onChange={setI} />
      <Time label="Range" value={lra} onChange={setLra} />
      <Time label="Peak" value={tp} onChange={setTp} />
      <Save
        label="Save normalized copy"
        onClick={() => apply("tool:normalize", { i, lra, tp }, setNote)}
      />
    </ToolShell>
  );
}

export function ChannelsTool() {
  const [layout, setLayout] = useState<"mono" | "stereo">("mono");
  const [left, setLeft] = useState(1);
  const [right, setRight] = useState(1);
  const [note, setNote] = useState("");
  return (
    <ToolShell title="Channels" note={note}>
      <div className="segmented">
        <button
          type="button"
          aria-pressed={layout === "mono"}
          onClick={() => setLayout("mono")}
        >
          Mono
        </button>
        <button
          type="button"
          aria-pressed={layout === "stereo"}
          onClick={() => setLayout("stereo")}
        >
          Stereo
        </button>
      </div>
      <label className="tool-row">
        Left
        <input
          type="range"
          min={0}
          max={200}
          value={left * 100}
          aria-label="Left volume"
          onChange={(event) => setLeft(Number(event.target.value) / 100)}
        />
        <span>{left.toFixed(2)}</span>
      </label>
      <label className="tool-row">
        Right
        <input
          type="range"
          min={0}
          max={200}
          value={right * 100}
          aria-label="Right volume"
          onChange={(event) => setRight(Number(event.target.value) / 100)}
        />
        <span>{right.toFixed(2)}</span>
      </label>
      <Save
        label="Save channel copy"
        onClick={() => apply("tool:channels", { layout, left, right }, setNote)}
      />
    </ToolShell>
  );
}

export function BleepTool() {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(1);
  const [hz, setHz] = useState(1000);
  const [note, setNote] = useState("");
  return (
    <ToolShell
      title="Bleep"
      note={note || "The chosen span is replaced with a tone."}
    >
      <Time label="Start" value={start} onChange={setStart} />
      <Time label="End" value={end} onChange={setEnd} />
      <Time label="Hz" value={hz} onChange={setHz} />
      <Save
        label="Save bleeped copy"
        onClick={() => apply("tool:bleep", { start, end, hz }, setNote)}
      />
    </ToolShell>
  );
}

export function VisualizerTool() {
  const [note, setNote] = useState("");
  return (
    <ToolShell
      title="Visualizer"
      note={note || "Saves a 1280×720 MP4 of the waveform."}
    >
      <Save
        label="Save visualizer"
        onClick={() => apply("tool:visualizer", {}, setNote)}
      />
    </ToolShell>
  );
}

function Time({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="tool-row">
      {label}
      <input
        type="number"
        step="0.1"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span />
    </label>
  );
}
