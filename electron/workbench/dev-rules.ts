import path from "node:path";
import type { ProjectInfo } from "../../src/dev-types.ts";

// Pure rules for the Dev hub, kept apart from Electron so they are testable.

const extensions = [".exe", ".cmd", ".ps1", ".bat"];

/** Folders a coding CLI may install into besides PATH. */
export function agentFolders(env: NodeJS.ProcessEnv, home: string) {
  const local = env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const roaming = env.APPDATA || path.join(home, "AppData", "Roaming");
  return [
    ...(env.PATH || "")
      .split(path.delimiter)
      .map((p) => p.replace(/^"|"$/g, ""))
      .filter(Boolean),
    path.join(roaming, "npm"),
    path.join(home, ".local", "bin"),
    path.join(local, "Microsoft", "WinGet", "Links"),
    path.join(home, "scoop", "shims"),
    path.join(home, ".bun", "bin"),
    path.join(home, ".cargo", "bin"),
  ];
}

/** First matching executable, preferring .exe over npm's shims. */
export function findCommand(
  command: string,
  folders: string[],
  exists: (file: string) => boolean,
) {
  const seen = new Set<string>();
  for (const ext of extensions)
    for (const folder of folders) {
      const file = path.join(folder, command + ext);
      const key = file.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (exists(file)) return file;
    }
  return "";
}

/** Reads `git status --porcelain=v2 --branch`. */
export function parseGitStatus(text: string): NonNullable<ProjectInfo["git"]> {
  let branch = "",
    ahead = 0,
    behind = 0,
    changes = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("# branch.head ")) branch = line.slice(14).trim();
    else if (line.startsWith("# branch.ab ")) {
      const match = /\+(\d+) -(\d+)/.exec(line);
      if (match) {
        ahead = Number(match[1]);
        behind = Number(match[2]);
      }
    } else if (/^[12u?] /.test(line)) changes++;
  }
  return {
    branch: branch === "(detached)" ? "detached" : branch,
    changes,
    ahead,
    behind,
  };
}

/** A project name from its folder, e.g. `D:\Code\yami` → `yami`. */
export function projectName(folder: string) {
  return path.basename(path.resolve(folder)) || folder;
}

/** Same folder, ignoring case and trailing separators as Windows does. */
export function sameFolder(a: string, b: string) {
  const clean = (p: string) =>
    path
      .resolve(p)
      .replace(/[\\/]+$/, "")
      .toLowerCase();
  return clean(a) === clean(b);
}

/** A link an editor registers for opening a folder. */
export function editorLink(scheme: "vscode" | "cursor", folder: string) {
  return `${scheme}://file/${encodeURI(path.resolve(folder).replace(/\\/g, "/"))}`;
}
