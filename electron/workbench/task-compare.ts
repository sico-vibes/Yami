import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseNumstat, safeRelative, type ChangedFile } from "./dev-rules.ts";

// Compares parallel tasks (fan-out worktrees) against the project's own
// checkout: what each one changed, committed or not, and one file's diff in
// each. Git runs only when the compare view asks; output is bounded.

const exec = promisify(execFile);
const MAX_DIFF = 200_000;
const git = (cwd: string, args: string[]) =>
  exec("git", ["-C", cwd, ...args], {
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 4 * 1024 * 1024,
  }).then((r) => r.stdout);

/** Where the task branched off the project's current commit. */
async function base(project: string, tree: string) {
  const head = (await git(project, ["rev-parse", "HEAD"])).trim();
  return (await git(tree, ["merge-base", "HEAD", head])).trim();
}

export async function taskChanges(
  project: string,
  tree: string,
): Promise<{ files: ChangedFile[]; added: number; removed: number }> {
  const from = await base(project, tree);
  const files = parseNumstat(
    await git(tree, ["diff", "--numstat", "--no-renames", from]),
  );
  const untracked = (
    await git(tree, ["ls-files", "--others", "--exclude-standard"])
  )
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 500);
  for (const file of untracked) {
    let lines = 0;
    try {
      const text = fs.readFileSync(path.join(tree, file), "utf8");
      lines = text.length > MAX_DIFF ? 0 : text.split("\n").length;
    } catch {}
    files.push({ file, added: lines, removed: 0, untracked: true });
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  return {
    files: files.slice(0, 1000),
    added: files.reduce((n, f) => n + f.added, 0),
    removed: files.reduce((n, f) => n + f.removed, 0),
  };
}

/** One file's changes in a task; a new file shows as all added lines. */
export async function taskFileDiff(
  project: string,
  tree: string,
  file: string,
) {
  if (!safeRelative(file)) throw new Error("That file is outside the task.");
  const target = path.resolve(tree, file);
  if (!target.startsWith(path.resolve(tree) + path.sep))
    throw new Error("That file is outside the task.");
  const from = await base(project, tree);
  let text = await git(tree, [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    from,
    "--",
    file,
  ]);
  if (!text && fs.existsSync(target)) {
    const body = fs.readFileSync(target, "utf8").slice(0, MAX_DIFF);
    text =
      `new file ${file}\n` +
      body
        .split("\n")
        .map((l) => "+" + l)
        .join("\n");
  }
  return text.length > MAX_DIFF
    ? text.slice(0, MAX_DIFF) + "\n… (cut at 200 KB)"
    : text || "No changes to this file in this task.";
}
