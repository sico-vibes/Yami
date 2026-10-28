import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const marker =
  "; Written by Yami. Reset the icon from the file wheel to remove it.";

/** The desktop.ini Windows reads for a custom folder icon. */
export function iconIni(icon: string) {
  return `${marker}\r\n[.ShellClassInfo]\r\nIconResource=${icon},0\r\n`;
}

/**
 * Sets a folder's icon the way Explorer's Customize tab does: desktop.ini
 * (hidden, system) plus the folder's read-only flag, which tells Explorer to
 * read it. A desktop.ini Yami did not write is never replaced.
 */
export async function setFolderIcon(folder: string, icon: string) {
  if (!/\.(ico|exe|dll)$/i.test(icon) || !fs.existsSync(icon))
    throw new Error("Choose an .ico file.");
  const ini = path.join(folder, "desktop.ini");
  if (fs.existsSync(ini) && !fs.readFileSync(ini, "utf8").includes(marker))
    throw new Error(
      "This folder already has its own desktop.ini, so Yami leaves it alone.",
    );
  if (fs.existsSync(ini))
    await exec("attrib.exe", ["-h", "-s", ini], { windowsHide: true });
  await fs.promises.writeFile(ini, iconIni(icon), "utf8");
  await exec("attrib.exe", ["+h", "+s", ini], { windowsHide: true });
  await exec("attrib.exe", ["+r", folder], { windowsHide: true });
}

/** Removes Yami's desktop.ini; the folder's read-only flag is cleared too. */
export async function resetFolderIcon(folder: string) {
  const ini = path.join(folder, "desktop.ini");
  if (!fs.existsSync(ini)) return false;
  if (!fs.readFileSync(ini, "utf8").includes(marker))
    throw new Error(
      "This folder's icon was not set by Yami, so it is left as it is.",
    );
  await exec("attrib.exe", ["-h", "-s", ini], { windowsHide: true });
  await fs.promises.rm(ini);
  await exec("attrib.exe", ["-r", folder], { windowsHide: true });
  return true;
}
