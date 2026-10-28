import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { renamePlan } from "../../src/wheel/rename.ts";
import type { WheelFile } from "../../src/wheel/types";

/**
 * Renames the files in order. It refuses to overwrite anything outside the
 * set, and renames through temporary names first so names can swap.
 */
export async function renameFiles(
  files: WheelFile[],
  pattern: string,
  start = 1,
) {
  const plan = renamePlan(
    files.map((f) => f.name),
    pattern,
    Math.max(0, Math.floor(start) || 0),
  );
  const moves = plan.map((step, i) => {
    const from = files[i].path;
    return { from, to: path.join(path.dirname(from), step.to) };
  });
  const sources = new Set(moves.map((m) => m.from.toLowerCase()));
  for (const m of moves)
    if (fs.existsSync(m.to) && !sources.has(m.to.toLowerCase()))
      throw new Error(
        `${path.basename(m.to)} already exists, so nothing was renamed.`,
      );
  const tag = randomBytes(4).toString("hex");
  const staged: { temp: string; to: string; from: string }[] = [];
  try {
    for (const m of moves) {
      if (m.from === m.to) continue;
      const temp = `${m.from}.yami-${tag}`;
      await fs.promises.rename(m.from, temp);
      staged.push({ temp, to: m.to, from: m.from });
    }
    for (const s of staged) await fs.promises.rename(s.temp, s.to);
  } catch (error) {
    // Put back whatever was only half way.
    for (const s of staged)
      if (fs.existsSync(s.temp))
        await fs.promises.rename(s.temp, s.from).catch(() => {});
    throw error;
  }
  return moves.map((m) => m.to);
}
