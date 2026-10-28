import fs from "node:fs";
import path from "node:path";

// Flatten: every file in a folder's subfolders moves up into the folder
// itself, and the subfolders that end up empty are removed. Names that would
// clash get " (2)", " (3)"…; nothing is ever overwritten. Links and
// junctions are not followed, and a failed move puts back what had moved.

const MAX_FILES = 20_000;
/** Windows paths compare without case; realpath may change a drive letter's. */
const samePath = (a: string, b: string) =>
  path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
export type FlattenMove = { from: string; to: string };

function walk(dir: string, out: string[], dirs: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (out.length > MAX_FILES)
      throw new Error(
        "This folder has more than 20,000 files; Flatten stops there.",
      );
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      // Junctions report as directories; their real path lies elsewhere.
      if (!samePath(fs.realpathSync(full), full)) continue;
      dirs.push(full);
      walk(full, out, dirs);
    } else if (entry.isFile()) out.push(full);
  }
}

function unique(name: string, taken: Set<string>) {
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let next = name;
  for (let n = 2; taken.has(next.toLowerCase()); n++)
    next = `${stem} (${n})${ext}`;
  taken.add(next.toLowerCase());
  return next;
}

/** The moves Flatten would make, in a stable order. */
export function flattenPlan(folder: string) {
  const root = path.resolve(folder);
  if (!fs.statSync(root).isDirectory()) throw new Error("Choose a folder.");
  const taken = new Set(
    fs
      .readdirSync(root, { withFileTypes: true })
      .map((e) => e.name.toLowerCase()),
  );
  const files: string[] = [];
  const dirs: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }))
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      const full = path.join(root, entry.name);
      if (!samePath(fs.realpathSync(full), full)) continue;
      dirs.push(full);
      walk(full, files, dirs);
    }
  files.sort((a, b) => a.localeCompare(b));
  const moves: FlattenMove[] = files.map((from) => ({
    from,
    to: path.join(root, unique(path.basename(from), taken)),
  }));
  return { moves, folders: dirs.length };
}

/** Moves the files up, then removes subfolders left empty. */
export async function flattenFolder(folder: string) {
  const { moves } = flattenPlan(folder);
  if (!moves.length) throw new Error("There is nothing in subfolders to move.");
  const done: FlattenMove[] = [];
  try {
    for (const m of moves) {
      if (fs.existsSync(m.to))
        throw new Error(`${path.basename(m.to)} appeared while flattening.`);
      await fs.promises.rename(m.from, m.to);
      done.push(m);
    }
  } catch (error) {
    for (const m of done.reverse())
      await fs.promises.rename(m.to, m.from).catch(() => {});
    throw error;
  }
  // Only subfolders that hold nothing but other empty folders now.
  const empty = (dir: string): boolean => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.isSymbolicLink()) return false;
      if (!empty(path.join(dir, e.name))) return false;
    }
    return true;
  };
  for (const e of fs.readdirSync(folder, { withFileTypes: true }))
    if (e.isDirectory() && !e.isSymbolicLink()) {
      const dir = path.join(folder, e.name);
      if (empty(dir)) await fs.promises.rm(dir, { recursive: true });
    }
  return done.map((m) => m.to);
}
