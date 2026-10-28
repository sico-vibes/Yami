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
import { findDuplicates, folderSize, size, zipEntries } from "./folder.ts";
import { resetFolderIcon, setFolderIcon } from "./folder-icon.ts";

export async function runFileAction(
  id: string,
  files: WheelFile[],
  notify: (message: string) => void,
  extra: {
    addProject?: (folder: string) => Promise<unknown>;
    /** Set by the desktop check, which cannot use the file dialog. */
    iconFile?: string;
  } = {},
) {
  if (id === "action:size") {
    const folders = files.filter((f) => f.folder);
    let bytes = 0,
      count = 0,
      partial = false;
    for (const f of folders) {
      const r = await folderSize(f.path);
      bytes += r.bytes;
      count += r.files;
      partial ||= r.partial;
    }
    notify(
      `${folders.length === 1 ? folders[0].name : `${folders.length} folders`}: ${partial ? "at least " : ""}${size(bytes)} in ${count.toLocaleString()} files.`,
    );
    return;
  }
  if (id === "action:icon" || id === "action:icon-reset") {
    const folder = files[0];
    if (!folder?.folder) throw new Error("Choose one folder.");
    if (id === "action:icon-reset") {
      notify(
        (await resetFolderIcon(folder.path))
          ? `${folder.name} has its usual icon again.`
          : `${folder.name} has no custom icon.`,
      );
      return;
    }
    const icon =
      extra.iconFile ||
      (
        await dialog.showOpenDialog({
          title: `Choose an icon for ${folder.name}`,
          properties: ["openFile"],
          filters: [{ name: "Icons", extensions: ["ico", "exe", "dll"] }],
        })
      ).filePaths[0];
    if (!icon) return;
    await setFolderIcon(folder.path, icon);
    notify(
      `${folder.name} has a new icon. Explorer may take a moment to show it.`,
    );
    return;
  }
  if (id === "action:duplicates") {
    const folder = files.find((f) => f.folder);
    if (!folder) throw new Error("Choose a folder.");
    const { groups, partial } = await findDuplicates(folder.path);
    if (!groups.length) {
      notify(
        `No duplicate files in ${folder.name}${partial ? " (checked part of it)" : ""}.`,
      );
      return;
    }
    const wasted = groups.reduce(
      (n, g) => n + g.bytes * (g.files.length - 1),
      0,
    );
    clipboard.writeText(
      groups
        .map(
          (g) =>
            `${size(g.bytes)} × ${g.files.length}\n` +
            g.files.map((f) => "  " + f).join("\n"),
        )
        .join("\n\n")
        .slice(0, 200000),
    );
    notify(
      `${groups.length} sets of duplicates in ${folder.name}, ${size(wasted)} repeated. The list is on the clipboard; nothing was deleted.`,
    );
    return;
  }
  if (id === "action:zip") {
    const entries: { name: string; data: Buffer }[] = [];
    for (const f of files)
      if (f.folder) entries.push(...(await zipEntries(f.path)));
      else
        entries.push({
          name: f.name,
          data: await fs.promises.readFile(f.path),
        });
    const base = files.length === 1 ? files[0].name : "Archive";
    const dest = destinationFor(
      path.dirname(files[0].path),
      base + ".zip",
      fs.existsSync,
    );
    const { packZip } = await import("./archive.ts");
    await fs.promises.writeFile(dest, packZip(entries), { flag: "wx" });
    notify(`Zipped to ${path.basename(dest)}.`);
    return;
  }
  if (id === "action:project") {
    if (!extra.addProject)
      throw new Error("Turn on the AI workspace to keep projects.");
    await extra.addProject(files[0].path);
    notify(`Added ${files[0].name} to Projects.`);
    return;
  }
  if (id === "action:path") {
    clipboard.writeText(
      pathText(files.map((file) => file.path)).slice(0, 8000),
    );
    notify("Copied the path.");
    return;
  }
  if (id === "action:copy") {
    if (process.platform !== "win32")
      throw new Error(
        "Copying files to the clipboard is available on Windows.",
      );
    const result = await runProcess(
      "powershell.exe",
      copyFileArguments(files.map((file) => file.path)),
    );
    if (result.code !== 0)
      throw new Error(result.stderr.trim() || "The files were not copied.");
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
      const dest = destinationFor(
        picked.filePaths[0],
        file.name,
        fs.existsSync,
      );
      try {
        await fs.promises.rename(file.path, dest);
      } catch {
        // Another drive: copy everything first, remove only after it worked.
        if (file.folder) {
          await fs.promises.cp(file.path, dest, {
            recursive: true,
            errorOnExist: true,
            force: false,
          });
          await fs.promises.rm(file.path, { recursive: true });
        } else {
          await fs.promises.copyFile(file.path, dest);
          await fs.promises.unlink(file.path);
        }
      }
    }
    notify(
      files.length === 1 ? "Moved the file." : `Moved ${files.length} files.`,
    );
    return;
  }
  if (id === "action:terminal") {
    if (process.platform !== "win32")
      throw new Error("The terminal action is available on Windows.");
    const launch = terminalLaunch(
      files[0].folder ? files[0].path : path.dirname(files[0].path),
    );
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
