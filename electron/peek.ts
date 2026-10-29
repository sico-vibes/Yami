import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BrowserWindow, screen } from "electron";
import { helperPath } from "./workbench/terminal";
import { peekKind, textPage, TEXT_LIMIT } from "./peek-kinds";

// Quick look (the idea of PowerToys Peek): Ctrl+Space on a file selected in
// File Explorer opens a preview. Pictures, PDFs, video and sound use
// Chromium's own viewers in a sandboxed window with scripts off (except the
// PDF viewer); text and code are shown as plain text, never run. Esc closes.

let current: BrowserWindow | undefined;

export async function openPeek(file: string): Promise<string> {
  if (current && !current.isDestroyed()) {
    current.close();
    current = undefined;
    return "closed";
  }
  const stat = await fs.promises.stat(file).catch(() => undefined);
  if (!stat?.isFile()) return "not a file";
  const kind = peekKind(file);
  if (!kind) return "no preview";
  const area = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint(),
  ).workArea;
  const width = Math.round(Math.min(1100, area.width * 0.7)),
    height = Math.round(Math.min(820, area.height * 0.8));
  const win = new BrowserWindow({
    width,
    height,
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    title: `${path.basename(file)} · Quick look`,
    backgroundColor: "#0b0a1e",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // The PDF viewer needs scripts; nothing else here runs any.
      javascript: kind === "pdf",
    },
  });
  current = win;
  win.on("closed", () => {
    if (current === win) current = undefined;
  });
  // Links and new windows never open from a preview.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.on("before-input-event", (e, input) => {
    if (
      input.type === "keyDown" &&
      (input.key === "Escape" || (input.control && input.key === " "))
    ) {
      e.preventDefault();
      win.close();
    }
  });
  win.once("ready-to-show", () => win.show());
  if (kind === "text") {
    const handle = await fs.promises.open(file, "r");
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, TEXT_LIMIT));
      await handle.read(buffer, 0, buffer.length, 0);
      const html = textPage(
        path.basename(file),
        buffer.toString("utf8"),
        stat.size > TEXT_LIMIT,
      );
      await win.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(html),
      );
    } finally {
      await handle.close();
    }
  } else await win.loadFile(file);
  return kind;
}

/** Ctrl+Space in File Explorer: previews the first selected file. */
export async function peekSelection(notify: (message: string) => void) {
  const { stdout } = await promisify(execFile)(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      helperPath("ExplorerSelection.ps1"),
    ],
    { windowsHide: true, timeout: 8000 },
  ).catch(() => ({ stdout: "{}" }));
  const paths: string[] = JSON.parse(stdout.trim() || "{}").paths || [];
  if (!paths.length) {
    if (current && !current.isDestroyed()) current.close();
    return;
  }
  const result = await openPeek(paths[0]);
  if (result === "no preview")
    notify(
      `Quick look has no preview for ${path.extname(paths[0]) || "this kind of file"}.`,
    );
}
