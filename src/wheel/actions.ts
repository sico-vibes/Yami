import { extensionOf } from "./catalog.ts";
import { allocateFile, stemOf } from "./naming.ts";

export function quotePowerShell(value: string) {
  if (/[\r\n\0]/.test(value))
    throw new Error("That path cannot be sent to PowerShell.");
  return `'${value.replace(/'/g, "''")}'`;
}

export function copyFileArguments(paths: string[]) {
  if (!paths.length) throw new Error("Choose a file.");
  return [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Set-Clipboard -LiteralPath ${paths.map(quotePowerShell).join(",")}`,
  ];
}

export function pathText(paths: string[]) {
  if (!paths.length) throw new Error("Choose a file.");
  return paths.join("\r\n");
}

export function terminalLaunch(directory: string) {
  return {
    command: "powershell.exe",
    args: [
      "-NoExit",
      "-NoProfile",
      "-Command",
      `Set-Location -LiteralPath ${quotePowerShell(directory)}`,
    ],
  };
}

export function destinationFor(
  directory: string,
  name: string,
  exists: (value: string) => boolean,
) {
  return allocateFile(
    directory,
    stemOf(name),
    extensionOf(name) || "dat",
    exists,
  );
}
