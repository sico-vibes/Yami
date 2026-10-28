import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "../api";
import { Icon, IconButton } from "../ui";
import { PETAL_ICON } from "./icons";

/** The open tool's petal id, so every tool header shows its own icon. */
export const ToolIdContext = createContext("");

export function ToolShell({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  const icon = PETAL_ICON[useContext(ToolIdContext)] || "wrench";
  return (
    <div className="tool-root">
      <header className="tool-head">
        <div className="tool-title">
          <span className="tool-icon">
            <Icon name={icon} size={18} />
          </span>
          <h1>{title}</h1>
        </div>
        <IconButton
          icon="x"
          label="Close"
          onClick={() => void api("wheel.close")}
        />
      </header>
      {children}
      {note && <p className="tool-note">{note}</p>}
    </div>
  );
}

export function Save({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => Promise<unknown> | void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="tool-actions">
      <span />
      <button
        type="button"
        className="primary-button"
        disabled={busy || disabled}
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
