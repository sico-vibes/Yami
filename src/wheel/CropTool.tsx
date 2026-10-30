import { useEffect, useRef, useState, type PointerEvent } from "react";
import { paintStill, sourceSize, useStill } from "./stage";
import { Save, ToolShell, savePng } from "./ToolShell";
import type { WheelFile } from "./types";
import { token } from "./palette";

type Box = { x: number; y: number; w: number; h: number };

export function CropTool({ files }: { files: WheelFile[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { image, note, setNote } = useStill(files[0]);
  const [box, setBox] = useState<Box>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const drag = useRef<Box | null>(null);
  useEffect(() => {
    if (!canvas.current || !image) return;
    const ctx = paintStill(canvas.current, image, 720);
    if (!ctx) return;
    ctx.strokeStyle = token("--paint-glow");
    ctx.lineWidth = 2;
    ctx.strokeRect(
      box.x * canvas.current.width,
      box.y * canvas.current.height,
      box.w * canvas.current.width,
      box.h * canvas.current.height,
    );
  }, [image, box]);
  const pointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };
  return (
    <ToolShell
      title="Crop"
      note={note || "Drag a rectangle. The saved file is a new PNG."}
    >
      <div className="tool-preview">
        <canvas
          ref={canvas}
          onPointerDown={(event) => {
            const start = pointer(event);
            drag.current = { ...start, w: 0, h: 0 };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const point = pointer(event);
            setBox(normalBox(drag.current.x, drag.current.y, point.x, point.y));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        />
      </div>
      <Save
        label="Save cropped copy"
        onClick={async () => {
          if (!image) return;
          const size = sourceSize(image);
          const exportCanvas = document.createElement("canvas");
          const width = Math.max(1, Math.round(size.width * box.w));
          const height = Math.max(1, Math.round(size.height * box.h));
          const fitted = Math.min(1, 2048 / Math.max(width, height));
          exportCanvas.width = Math.max(1, Math.round(width * fitted));
          exportCanvas.height = Math.max(1, Math.round(height * fitted));
          exportCanvas
            .getContext("2d")
            ?.drawImage(
              image,
              size.width * box.x,
              size.height * box.y,
              width,
              height,
              0,
              0,
              exportCanvas.width,
              exportCanvas.height,
            );
          await savePng(exportCanvas, "tool:crop").catch((error: Error) =>
            setNote(error.message),
          );
        }}
      />
    </ToolShell>
  );
}

function normalBox(x1: number, y1: number, x2: number, y2: number): Box {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return {
    x,
    y,
    w: Math.max(0.02, Math.abs(x2 - x1)),
    h: Math.max(0.02, Math.abs(y2 - y1)),
  };
}
