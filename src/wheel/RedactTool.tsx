import { useEffect, useRef, useState, type PointerEvent } from "react";
import { paintStill, useStill } from "./stage";
import { Save, ToolShell, savePng } from "./ToolShell";
import type { WheelFile } from "./types";

type Box = { x: number; y: number; w: number; h: number; mode: "solid" | "blur" };

export function RedactTool({ files }: { files: WheelFile[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { image, note, setNote } = useStill(files[0]);
  const [mode, setMode] = useState<Box["mode"]>("solid");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (canvas.current && image) redraw(canvas.current, image, boxes, null);
  }, [image, boxes]);
  const at = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };
  return (
    <ToolShell
      title="Redact"
      note={note || "Draw boxes to cover or blur. Face and text finding are not in this build, and nothing is uploaded."}
    >
      <div className="tool-preview">
        <canvas
          ref={canvas}
          onPointerDown={(event) => {
            drag.current = at(event);
          }}
          onPointerMove={(event) => {
            if (!drag.current || !canvas.current || !image) return;
            const point = at(event);
            redraw(canvas.current, image, boxes, boxFrom(drag.current, point, mode));
          }}
          onPointerUp={(event) => {
            if (!drag.current) return;
            setBoxes((current) => [...current, boxFrom(drag.current!, at(event), mode)]);
            drag.current = null;
          }}
        />
      </div>
      <div className="segmented">
        <button type="button" aria-pressed={mode === "solid"} onClick={() => setMode("solid")}>
          Cover
        </button>
        <button type="button" aria-pressed={mode === "blur"} onClick={() => setMode("blur")}>
          Blur
        </button>
        <button type="button" onClick={() => setBoxes((current) => current.slice(0, -1))}>
          Undo
        </button>
      </div>
      <Save
        label="Save redacted copy"
        onClick={() => savePng(canvas.current, "tool:redact").catch((error: Error) => setNote(error.message))}
      />
    </ToolShell>
  );
}

function boxFrom(start: { x: number; y: number }, end: { x: number; y: number }, mode: Box["mode"]): Box {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.max(0.02, Math.abs(end.x - start.x)),
    h: Math.max(0.02, Math.abs(end.y - start.y)),
    mode,
  };
}

function redraw(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  boxes: Box[],
  draft: Box | null,
) {
  const ctx = paintStill(canvas, image, 720);
  if (!ctx) return;
  for (const box of draft ? [...boxes, draft] : boxes) {
    const x = box.x * canvas.width;
    const y = box.y * canvas.height;
    const w = box.w * canvas.width;
    const h = box.h * canvas.height;
    if (box.mode === "blur") {
      ctx.save();
      ctx.filter = "blur(12px)";
      ctx.drawImage(canvas, x, y, w, h, x, y, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = "#17140b";
      ctx.fillRect(x, y, w, h);
    }
  }
}
