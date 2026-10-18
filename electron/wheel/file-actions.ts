import { clipboard, dialog } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  copyFileArguments,
  destinationFor,
  pathText,
  terminalLaunch,
} from "../../src/wheel/actions.ts";
import type { WheelFile } from "../../src/wheel/types";
import { runProcess } from "./spawn.ts";

export async function runFileAction(
  id: string,
  files: WheelFile[],
  notify: (message: string) => void,
) {
  if (id === "action:path") {
    clipboard.writeText(pathText(files.map((file) => file.path)).slice(0, 8000));
    notify("Copied the path.");
    return;
  }
  if (id === "action:copy") {
    if (process.platform !== "win32")
      throw new Error("Copying files to the clipboard is available on Windows.");
    const result = await runProcess("powershell.exe", copyFileArguments(files.map((file) => file.path)));
    if (result.code !== 0) throw new Error(result.stderr.trim() || "The files were not copied.");
    notify("Copied the files.");
    return;
  }
  if (id === "action:move") {
    const picked = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Move files to",
    });
    if (picked.canceled || !picked.filePaths[0]) return;
    for (const file of files) {
      const dest = destinationFor(picked.filePaths[0], file.name, fs.existsSync);
      try {
        await fs.promises.rename(file.path, dest);
      } catch {
        await fs.promises.copyFile(file.path, dest);
        await fs.promises.unlink(file.path);
      }
    }
    notify(files.length === 1 ? "Moved the file." : `Moved ${files.length} files.`);
    return;
  }
  if (id === "action:terminal") {
    if (process.platform !== "win32")
      throw new Error("The terminal action is available on Windows.");
    const launch = terminalLaunch(path.dirname(files[0].path));
    const child = spawn(launch.command, launch.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    notify("Opened PowerShell.");
    return;
  }
  throw new Error("That action is not connected yet.");
}
