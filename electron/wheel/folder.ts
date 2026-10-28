import fs from "node:fs";
import path from "node:path";

// Folder work for the file wheel's actions; plain Node, so it is testable.

/** Bytes and files in a folder tree, stopping at 200,000 entries or 15 s. */
export async function folderSize(root: string, limit = 200_000, ms = 15_000) {
  const until = Date.now() + ms;
  let bytes = 0,
    files = 0,
    seen = 0,
    partial = false;
  const stack = [root];
  while (stack.length) {
    if (seen > limit || Date.now() > until) {
      partial = true;
      break;
    }
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      seen++;
      const full = path.join(dir, entry.name);
      // Links are not followed, so a junction cannot loop or leave the tree.
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        files++;
        try {
          bytes += (await fs.promises.stat(full)).size;
        } catch {}
      }
    }
  }
  return { bytes, files, partial };
}

/** Every file under a folder as zip entries, refusing more than 200 MB. */
export async function zipEntries(root: string, max = 200 * 1024 * 1024) {
  const entries: { name: string; data: Buffer }[] = [];
  let total = 0;
  const walk = async (dir: string, prefix: string) => {
    for (const entry of await fs.promises.readdir(dir, {
      withFileTypes: true,
    })) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      const name = prefix + entry.name;
      if (entry.isDirectory()) await walk(full, name + "/");
      else if (entry.isFile()) {
        total += (await fs.promises.stat(full)).size;
        if (total > max)
          throw new Error(
            "That folder is over 200 MB. Zip it with 7-Zip instead.",
          );
        entries.push({ name, data: await fs.promises.readFile(full) });
      }
    }
  };
  await walk(root, path.basename(root) + "/");
  return entries;
}

/**
 * Groups of identical files under a folder: same size first, then the same
 * SHA-256. Bounded like folderSize; links are not followed; read-only.
 */
export async function findDuplicates(
  root: string,
  limit = 50_000,
  ms = 30_000,
) {
  const { createHash } = await import("node:crypto");
  const until = Date.now() + ms;
  const bySize = new Map<number, string[]>();
  const stack = [root];
  let seen = 0,
    partial = false;
  while (stack.length) {
    if (seen > limit || Date.now() > until) {
      partial = true;
      break;
    }
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      seen++;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile())
        try {
          const bytes = (await fs.promises.stat(full)).size;
          if (bytes > 0)
            bySize.set(bytes, [...(bySize.get(bytes) || []), full]);
        } catch {}
    }
  }
  const groups: { bytes: number; files: string[] }[] = [];
  for (const [bytes, files] of bySize) {
    if (files.length < 2 || Date.now() > until) continue;
    const byHash = new Map<string, string[]>();
    for (const file of files)
      try {
        const hash = createHash("sha256")
          .update(await fs.promises.readFile(file))
          .digest("hex");
        byHash.set(hash, [...(byHash.get(hash) || []), file]);
      } catch {}
    for (const same of byHash.values())
      if (same.length > 1) groups.push({ bytes, files: same.sort() });
  }
  groups.sort((a, b) => b.bytes * b.files.length - a.bytes * a.files.length);
  return { groups, partial };
}

export const size = (n: number) =>
  n < 1024
    ? `${n} ${n === 1 ? "byte" : "bytes"}`
    : n < 1024 ** 2
      ? `${Math.round(n / 1024)} KB`
      : n < 1024 ** 3
        ? `${(n / 1024 ** 2).toFixed(1)} MB`
        : `${(n / 1024 ** 3).toFixed(2)} GB`;
