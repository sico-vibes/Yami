import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  BACKGROUND_PRESETS,
  backgroundDefaults,
  paintBackground,
  sampleStill,
  type BackgroundChoice,
  type BackgroundSettings,
} from "./paint";
import type { WheelFile } from "./types";

export function BackgroundTool({ files }: { files: WheelFile[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<CanvasImageSource | null>(null);
  const backdrop = useRef<CanvasImageSource | null>(null);
  const [settings, setSettings] = useState<BackgroundSettings>(backgroundDefaults);
  const [choices, setChoices] = useState<BackgroundChoice[]>(BACKGROUND_PRESETS);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const file = files[0];
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (canvas.current)
        paintBackground(canvas.current, image.current, settings, choices, backdrop.current);
    };
    void (async () => {
      const extra = await api("wheel.backgrounds").catch(() => []);
      if (cancelled) return;
      const wallpapers = (extra as { id: string; url: string }[]).map((item) => ({
        id: item.id,
        kind: "image" as const,
        url: item.url,
      }));
      setChoices([...BACKGROUND_PRESETS, ...wallpapers]);
      if (!file || file.path.startsWith("preview://")) {
        image.current = sampleStill();
        draw();
        return;
      }
      try {
        const url = await api("wheel.preview", { path: file.path });
        const loaded = new Image();
        loaded.onload = () => {
          image.current = loaded;
          draw();
        };
        loaded.src = url;
      } catch (error) {
        setNote(error instanceof Error ? error.message : "Preview unavailable.");
        image.current = sampleStill();
        draw();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file?.path]);
  useEffect(() => {
    const choice = choices.find((item) => item.id === settings.background);
    if (!choice || choice.kind !== "image") {
      backdrop.current = null;
      if (canvas.current)
        paintBackground(canvas.current, image.current, settings, choices, null);
      return;
    }
    const loaded = new Image();
    loaded.onload = () => {
      backdrop.current = loaded;
      if (canvas.current)
        paintBackground(canvas.current, image.current, settings, choices, loaded);
    };
    loaded.src = choice.url;
  }, [settings, choices]);
  const patch = (next: Partial<BackgroundSettings>) => setSettings((current) => ({ ...current, ...next }));
  return (
    <div className="tool-root">
      <header className="tool-head">
        <h1>Background</h1>
        <button type="button" aria-label="Close" onClick={() => void api("wheel.close")}>
          ×
        </button>
      </header>
      <div className="tool-preview">
        <canvas ref={canvas} />
      </div>
      <div className="swatches" role="listbox" aria-label="Background">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            aria-label={choice.id}
            aria-pressed={settings.background === choice.id}
            style={{
              background:
                choice.kind === "solid"
                  ? choice.color
                  : choice.kind === "gradient"
                    ? `linear-gradient(135deg, ${choice.stops.join(",")})`
                    : `center/cover url("${choice.url}")`,
            }}
            onClick={() => patch({ background: choice.id })}
          />
        ))}
        <label className="soft-button">
          Image
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (!picked) return;
              const reader = new FileReader();
              reader.onload = () => {
                const url = String(reader.result || "");
                setChoices((current) => [
                  ...current.filter((item) => item.id !== "picked"),
                  { id: "picked", kind: "image", url },
                ]);
                patch({ background: "picked" });
              };
              reader.readAsDataURL(picked);
            }}
          />
        </label>
      </div>
      {(
        [
          ["padding", "Padding", 0, 240, "px"],
          ["corners", "Corners", 0, 80, "px"],
          ["shadow", "Shadow", 0, 80, "px"],
          ["blur", "Blur", 0, 40, "px"],
        ] as const
      ).map(([key, label, min, max, unit]) => (
        <label className="tool-row" key={key}>
          {label}
          <input
            type="range"
            min={min}
            max={max}
            value={settings[key]}
            aria-label={label}
            onChange={(event) => patch({ [key]: Number(event.target.value) })}
          />
          <span>
            {settings[key]} {unit}
          </span>
        </label>
      ))}
      <div className="tool-row">
        <span>Ratio</span>
        <div className="segmented">
          {(["auto", "1:1", "16:9", "4:5"] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              aria-pressed={settings.ratio === ratio}
              onClick={() => patch({ ratio })}
            >
              {ratio === "auto" ? "Auto" : ratio}
            </button>
          ))}
        </div>
      </div>
      {note && <p className="tool-note">{note}</p>}
      <div className="tool-actions">
        <button type="button" onClick={() => setSettings(backgroundDefaults)}>
          Reset
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            const png = canvas.current?.toDataURL("image/png") || "";
            void api("wheel.tool.apply", { tool: "tool:background", png })
              .catch((error: Error) => setNote(error.message))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Saving…" : "Save with background"}
        </button>
      </div>
    </div>
  );
}
