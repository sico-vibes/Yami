import { useEffect, useRef, useState } from "react";
import { useStills } from "./stage";
import { Save, ToolShell, savePng } from "./ToolShell";
import type { WheelFile } from "./types";
import { token } from "./palette";

export function CollageTool({ files }: { files: WheelFile[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { images, note, setNote } = useStills(files);
  const [columns, setColumns] = useState(2);
  const [gap, setGap] = useState(16);
  useEffect(() => {
    if (canvas.current && images.length)
      paintCollage(canvas.current, images, columns, gap);
  }, [images, columns, gap]);
  return (
    <ToolShell title="Collage" note={note || "The grid is saved as a new PNG."}>
      <div className="tool-preview">
        <canvas ref={canvas} />
      </div>
      <label className="tool-row">
        Columns
        <input
          type="range"
          min={1}
          max={4}
          value={columns}
          aria-label="Columns"
          onChange={(event) => setColumns(Number(event.target.value))}
        />
        <span>{columns}</span>
      </label>
      <label className="tool-row">
        Gap
        <input
          type="range"
          min={0}
          max={48}
          value={gap}
          aria-label="Gap"
          onChange={(event) => setGap(Number(event.target.value))}
        />
        <span>{gap}</span>
      </label>
      <Save
        label="Save collage"
        onClick={() =>
          savePng(canvas.current, "tool:collage").catch((error: Error) =>
            setNote(error.message),
          )
        }
      />
    </ToolShell>
  );
}

function paintCollage(
  canvas: HTMLCanvasElement,
  images: CanvasImageSource[],
  columns: number,
  gap: number,
) {
  const cols = Math.max(1, Math.min(4, columns));
  const rows = Math.ceil(images.length / cols);
  const cell = 280;
  canvas.width = cols * cell + gap * (cols + 1);
  canvas.height = rows * cell + gap * (rows + 1);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = token("--paint-ink");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  images.forEach((image, index) => {
    const x = gap + (index % cols) * (cell + gap);
    const y = gap + Math.floor(index / cols) * (cell + gap);
    ctx.drawImage(image, x, y, cell, cell);
  });
}
