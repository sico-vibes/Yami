import { useState, type ReactNode } from "react";
import { api } from "../api";

export function ToolShell({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="tool-root">
      <header className="tool-head">
        <h1>{title}</h1>
        <button type="button" aria-label="Close" onClick={() => void api("wheel.close")}>
          ×
        </button>
      </header>
      {children}
      {note && <p className="tool-note">{note}</p>}
    </div>
  );
}

export function Save({
  label,
  onClick,
}: {
  label: string;
  onClick: () => Promise<unknown> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="tool-actions">
      <span />
      <button
        type="button"
        className="primary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void Promise.resolve(onClick()).finally(() => setBusy(false));
        }}
      >
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}

export function savePng(canvas: HTMLCanvasElement | null, tool: string) {
  if (!canvas) throw new Error("Nothing is ready to save.");
  return api("wheel.tool.apply", { tool, png: canvas.toDataURL("image/png") });
}
