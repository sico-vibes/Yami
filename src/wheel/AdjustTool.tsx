import { useEffect, useRef, useState } from "react";
import { adjustDefaults, adjustFields, adjustRgba, type AdjustSettings } from "./adjust";
import { paintStill, useStill } from "./stage";
import { Save, ToolShell, savePng } from "./ToolShell";
import type { WheelFile } from "./types";

export function AdjustTool({ files }: { files: WheelFile[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { image, note, setNote } = useStill(files[0]);
  const [settings, setSettings] = useState<AdjustSettings>(adjustDefaults);
  useEffect(() => {
    if (!canvas.current || !image) return;
    drawAdjusted(canvas.current, image, settings, 640);
  }, [image, settings]);
  return (
    <ToolShell title="Adjust" note={note || "The saved copy is a new PNG, up to 1600 pixels on the long side."}>
      <div className="tool-preview">
        <canvas ref={canvas} />
      </div>
      {adjustFields.map(([key, label]) => (
        <label className="tool-row" key={key}>
          {label}
          <input
            type="range"
            min={key === "grain" || key === "vignette" ? 0 : -100}
            max={100}
            value={settings[key]}
            aria-label={label}
            onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
          />
          <span>{settings[key]}</span>
        </label>
      ))}
      <div className="tool-actions">
        <button type="button" onClick={() => setSettings(adjustDefaults)}>
          Reset
        </button>
        <span />
      </div>
      <Save
        label="Save edited copy"
        onClick={async () => {
          if (!image) return;
          const exportCanvas = document.createElement("canvas");
          drawAdjusted(exportCanvas, image, settings, 1600);
          await savePng(exportCanvas, "tool:adjust").catch((error: Error) => setNote(error.message));
        }}
      />
    </ToolShell>
  );
}

function drawAdjusted(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  settings: AdjustSettings,
  max: number,
) {
  const ctx = paintStill(canvas, image, max);
  if (!ctx) return;
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  frame.data.set(adjustRgba(frame.data, canvas.width, canvas.height, settings));
  ctx.putImageData(frame, 0, 0);
}
