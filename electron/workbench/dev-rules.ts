import path from "node:path";
import type { AgentCli, ProjectInfo } from "../../src/dev-types.ts";

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

export type Worktree = {
  path: string;
  branch: string;
  head: string;
  main: boolean;
};

/** Reads `git worktree list --porcelain`; the first entry is the main one. */
export function parseWorktrees(text: string): Worktree[] {
  const out: Worktree[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const tree = lines.find((l) => l.startsWith("worktree "));
    if (!tree) continue;
    const branch = lines.find((l) => l.startsWith("branch "));
    out.push({
      path: path.normalize(tree.slice(9).trim()),
      branch: branch
        ? branch
            .slice(7)
            .trim()
            .replace(/^refs\/heads\//, "")
        : lines.includes("detached")
          ? "detached"
          : "",
      head: (lines.find((l) => l.startsWith("HEAD ")) || "").slice(5, 17),
      main: !out.length,
    });
  }
  return out;
}

/**
 * Where a new task's worktree goes: a `<project>.worktrees` folder beside the
 * project, on a `yami/<name>` branch. Names are kept to safe characters.
 */
export function worktreePlan(project: string, name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!slug) throw new Error("Name the task with letters or numbers.");
  const root = path.resolve(project);
  const folder = path.join(
    path.dirname(root),
    path.basename(root) + ".worktrees",
    slug,
  );
  const branch = "yami/" + slug;
  return {
    branch,
    folder,
    args: ["-C", root, "worktree", "add", "-b", branch, folder],
  };
}

/** The task file each fan-out worktree gets; kept out of git by info/exclude. */
export const TASK_FILE = ".yami-task.md";
const instruction = `Read ${TASK_FILE} in this folder and do the task it describes.`;

/** The typed command: the instruction holds no quotes or shell characters. */
export function promptCommand(cli: AgentCli) {
  if (cli.prompt === "argument") return `${cli.command} "${instruction}"`;
  if (cli.prompt === "--prompt")
    return `${cli.command} --prompt "${instruction}"`;
  throw new Error(`${cli.name} cannot start with a prompt from Yami.`);
}

/**
 * Fan out: the same task for several agents, each in its own worktree on a
 * `yami/<name>-<agent>` branch, so their results can be compared.
 */
export function fanOutPlan(project: string, name: string, clis: AgentCli[]) {
  if (clis.length < 2 || clis.length > 4)
    throw new Error("Choose two to four agents.");
  if (new Set(clis.map((c) => c.id)).size !== clis.length)
    throw new Error("Choose each agent once.");
  // Short enough that the agent's id always fits in the 40-character slug.
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28)
    .replace(/-+$/, "");
  if (!base) throw new Error("Name the task with letters or numbers.");
  return clis.map((cli) => ({
    cli,
    command: promptCommand(cli),
    ...worktreePlan(project, `${base}-${cli.id}`),
  }));
}
