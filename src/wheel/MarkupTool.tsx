import { useEffect, useRef, useState, type PointerEvent } from "react";
import { paintStill, useStill } from "./stage";
import { Save, ToolShell, savePng } from "./ToolShell";
import type { WheelFile } from "./types";
import { markInks } from "./palette";

type Kind = "arrow" | "box" | "ellipse" | "text" | "label" | "lens";
type Mark = {
  kind: Kind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  text: string;
  color: string;
};


export function MarkupTool({ files }: { files: WheelFile[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { image, note, setNote } = useStill(files[0]);
  const [kind, setKind] = useState<Kind>("arrow");
  const [inks] = useState(markInks);
  const [color, setColor] = useState(() => inks[0].color);
  const [text, setText] = useState("Note");
  const [marks, setMarks] = useState<Mark[]>([]);
  const draft = useRef<Mark | null>(null);
  useEffect(() => {
    if (!canvas.current || !image) return;
    const ctx = paintStill(canvas.current, image, 720);
    if (!ctx) return;
    for (const mark of marks) drawMark(ctx, canvas.current, mark);
  }, [image, marks]);
  const at = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };
  return (
    <ToolShell title="Markup" note={note || "Arrows, shapes, labels, and a magnifier are drawn on a new PNG."}>
      <div className="tool-preview">
        <canvas
          ref={canvas}
          onPointerDown={(event) => {
            const point = at(event);
            const label = String(marks.filter((mark) => mark.kind === "label").length + 1);
            draft.current = {
              kind,
              ...point,
              x2: point.x,
              y2: point.y,
              text: kind === "label" ? label : text,
              color,
            };
          }}
          onPointerMove={(event) => {
            if (!draft.current || !canvas.current || !image) return;
            const point = at(event);
            draft.current = { ...draft.current, x2: point.x, y2: point.y };
            const ctx = paintStill(canvas.current, image, 720);
            if (!ctx) return;
            for (const mark of marks) drawMark(ctx, canvas.current, mark);
            drawMark(ctx, canvas.current, draft.current);
          }}
          onPointerUp={() => {
            if (draft.current) setMarks((current) => [...current, draft.current as Mark]);
            draft.current = null;
          }}
        />
      </div>
      <div className="markup-tools">
        {(["arrow", "box", "ellipse", "text", "label", "lens"] as Kind[]).map((item) => (
          <button key={item} type="button" aria-pressed={kind === item} onClick={() => setKind(item)}>
            {item}
          </button>
        ))}
      </div>
      <label className="tool-row">
        Text
        <input aria-label="Markup text" value={text} onChange={(event) => setText(event.target.value.slice(0, 80))} />
        <span />
      </label>
      <div className="swatches" aria-label="Ink">
        {inks.map((ink) => (
          <button key={ink.name} type="button" aria-label={ink.name} data-tip={ink.name} aria-pressed={color === ink.color} style={{ background: ink.color }} onClick={() => setColor(ink.color)} />
        ))}
      </div>
      <div className="tool-actions">
        <button type="button" onClick={() => setMarks((current) => current.slice(0, -1))}>
          Undo
        </button>
        <span />
      </div>
      <Save
        label="Save annotated copy"
        onClick={() => savePng(canvas.current, "tool:markup").catch((error: Error) => setNote(error.message))}
      />
    </ToolShell>
  );
}

function drawMark(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, mark: Mark) {
  const x = mark.x * canvas.width;
  const y = mark.y * canvas.height;
  const x2 = mark.x2 * canvas.width;
  const y2 = mark.y2 * canvas.height;
  ctx.save();
  ctx.strokeStyle = mark.color;
  ctx.fillStyle = mark.color;
  ctx.lineWidth = 3;
  if (mark.kind === "box" || mark.kind === "ellipse") {
    ctx.beginPath();
    if (mark.kind === "box") ctx.strokeRect(x, y, x2 - x, y2 - y);
    else ctx.ellipse((x + x2) / 2, (y + y2) / 2, Math.abs(x2 - x) / 2, Math.abs(y2 - y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mark.kind === "arrow") {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const angle = Math.atan2(y2 - y, x2 - x);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 12 * Math.cos(angle - 0.4), y2 - 12 * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - 12 * Math.cos(angle + 0.4), y2 - 12 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  } else if (mark.kind === "lens") {
    ctx.beginPath();
    ctx.arc(x2, y2, 42, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(canvas, x2 - 42, y2 - 42, 84, 84, x2 - 84, y2 - 84, 168, 168);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x2, y2, 42, 0, Math.PI * 2);
    ctx.stroke();
    return;
  } else {
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(mark.text || "Note", x, y);
  }
  ctx.restore();
}
