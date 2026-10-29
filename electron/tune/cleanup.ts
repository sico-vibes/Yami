import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Tune › Cleanup: per-user folders Windows and apps rebuild by themselves,
// measured first, then emptied only for the areas you pick. Nothing needs
// administrator rights. Links and junctions are never followed, a file in
// use is skipped, and each area's own folder is kept.

export type CleanupArea = {
  id: string;
  name: string;
  detail: string;
  bytes: number;
  files: number;
};
export type CleanupResult = { freed: number; removed: number; skipped: number };

type Area = {
  id: string;
  name: string;
  detail: string;
  dirs: string[];
  /** Only files not changed for this long, so running installers keep theirs. */
  olderThan?: number;
};

const DAY = 24 * 60 * 60_000;
const MAX_FILES = 300_000;

/** Measures folders; the native helper when there is one. */
export type FolderStats = (
  dirs: string[],
  olderThan: number,
  skip?: string,
) => Promise<{ bytes: number; files: number }>;

/**
 * Yami.FileStats.exe reads sizes and dates from the folder listings with
 * eight threads: 53,000 temp files in about 2 seconds, where reading each
 * file from Node took 19.
 */
export function nativeStats(exe: string): FolderStats | undefined {
  if (!fs.existsSync(exe)) return undefined;
  return async (dirs, olderThan, skip) => {
    const { stdout } = await exec(
      exe,
      [String(olderThan / 60_000), skip || "-", ...dirs],
      { windowsHide: true, timeout: 120_000 },
    );
    const out = JSON.parse(stdout);
    return { bytes: Number(out.bytes) || 0, files: Number(out.files) || 0 };
  };
}

export class CleanupController {
  private scanning?: Promise<CleanupArea[]>;
  constructor(
    /** Tests point every area, and the Recycle Bin, into one folder. */
    private root = process.env.YAMI_CLEANUP_ROOT || "",
    private stats?: FolderStats,
  ) {}

  private async areas(): Promise<Area[]> {
    const local = this.root
      ? path.join(this.root, "LocalAppData")
      : process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const temp = this.root ? path.join(this.root, "Temp") : os.tmpdir();
    const at = (...parts: string[]) => path.join(local, ...parts);
    return [
      {
        id: "temp",
        name: "Temporary files",
        detail: "Files apps left in your temp folder, untouched for a day",
        dirs: [temp],
        olderThan: DAY,
      },
      {
        id: "shaders",
        name: "Graphics shader caches",
        detail:
          "DirectX, NVIDIA and AMD build these again the next time a game or app needs them",
        dirs: [
          at("D3DSCache"),
          at("NVIDIA", "DXCache"),
          at("NVIDIA", "GLCache"),
          at("AMD", "DxCache"),
          at("AMD", "DxcCache"),
          at("AMD", "GLCache"),
        ],
      },
      {
        id: "reports",
        name: "Error reports",
        detail: "Problem reports Windows saved after apps crashed or hung",
        dirs: [
          at("Microsoft", "Windows", "WER", "ReportArchive"),
          at("Microsoft", "Windows", "WER", "ReportQueue"),
        ],
      },
      {
        id: "dumps",
        name: "Crash dumps",
        detail: "Memory snapshots apps saved when they crashed",
        dirs: [at("CrashDumps")],
      },
      {
        id: "recycle",
        name: "Recycle Bin",
        detail:
          "Files you deleted, on every drive. They cannot be restored after this",
        dirs: await this.recycleDirs(),
      },
    ];
  }

  /** This account's own Recycle Bin folder on each drive. */
  private async recycleDirs() {
    if (this.root) return [path.join(this.root, "RecycleBin")];
    let sid = "";
    try {
      const { stdout } = await exec(
        "whoami.exe",
        ["/user", "/fo", "csv", "/nh"],
        {
          windowsHide: true,
          timeout: 5000,
        },
      );
      sid = /"(S-1-[\d-]+)"/.exec(stdout)?.[1] || "";
    } catch {}
    if (!sid) return [];
    const dirs: string[] = [];
    for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
      const dir = `${letter}:\\$Recycle.Bin\\${sid}`;
      if (fs.existsSync(dir)) dirs.push(dir);
    }
    return dirs;
  }

  /** Every file under the area's folders that cleaning would remove. */
  private async walk(
    area: Area,
    visit: (file: string, size: number) => unknown,
  ) {
    const cutoff = area.olderThan ? Date.now() - area.olderThan : Infinity;
    let seen = 0;
    const go = async (dir: string): Promise<void> => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      const files: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) await go(full);
        // The Recycle Bin's own settings file stays.
        else if (
          entry.isFile() &&
          !(area.id === "recycle" && entry.name.toLowerCase() === "desktop.ini")
        )
          files.push(full);
      }
      // Files are read 64 at a time; one by one, 50,000 took 40 seconds.
      for (let i = 0; i < files.length && seen < MAX_FILES; i += 64)
        await Promise.all(
          files.slice(i, i + 64).map(async (full) => {
            let stat: fs.Stats;
            try {
              stat = await fs.promises.lstat(full);
            } catch {
              return;
            }
            if (stat.mtimeMs > cutoff || seen >= MAX_FILES) return;
            seen++;
            await visit(full, stat.size);
          }),
        );
    };
    for (const dir of area.dirs) await go(dir);
  }

  /** Measures each area; nothing is removed. */
  scan(): Promise<CleanupArea[]> {
    this.scanning ||= (async () => {
      try {
        const out: CleanupArea[] = [];
        for (const area of await this.areas()) {
          let bytes = 0,
            files = 0;
          const fast = await this.stats?.(
            area.dirs,
            area.olderThan || 0,
            area.id === "recycle" ? "desktop.ini" : undefined,
          ).catch(() => undefined);
          if (fast) ({ bytes, files } = fast);
          else
            await this.walk(area, (_f, size) => {
              bytes += size;
              files++;
            });
          out.push({
            id: area.id,
            name: area.name,
            detail: area.detail,
            bytes,
            files,
          });
        }
        return out;
      } finally {
        this.scanning = undefined;
      }
    })();
    return this.scanning;
  }

  /** Removes the files of the chosen areas; files in use are skipped. */
  async clean(ids: unknown): Promise<CleanupResult> {
    const wanted = new Set(Array.isArray(ids) ? ids.map(String) : []);
    const areas = (await this.areas()).filter((a) => wanted.has(a.id));
    if (!areas.length) throw new Error("Choose what to clean.");
    const result: CleanupResult = { freed: 0, removed: 0, skipped: 0 };
    for (const area of areas) {
      if (area.id === "recycle" && !this.root) {
        await this.emptyRecycleBin(area, result);
        continue;
      }
      await this.walk(area, async (file, size) => {
        try {
          await fs.promises.unlink(file);
          result.freed += size;
          result.removed++;
        } catch {
          result.skipped++;
        }
      });
      const cutoff = area.olderThan ? Date.now() - area.olderThan : Infinity;
      for (const dir of area.dirs) await removeEmpty(dir, true, cutoff);
    }
    return result;
  }

  /** Windows' own Clear-RecycleBin, so its index stays consistent. */
  private async emptyRecycleBin(area: Area, result: CleanupResult) {
    let bytes = 0,
      files = 0;
    await this.walk(area, (_f, size) => {
      bytes += size;
      files++;
    });
    await exec(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Clear-RecycleBin -Force -ErrorAction SilentlyContinue",
      ],
      { windowsHide: true, timeout: 120_000 },
    ).catch(() => {});
    let left = 0,
      leftFiles = 0;
    await this.walk(area, (_f, size) => {
      left += size;
      leftFiles++;
    });
    result.freed += Math.max(0, bytes - left);
    result.removed += Math.max(0, files - leftFiles);
    result.skipped += leftFiles;
  }
}

/**
 * Removes empty folders below dir, bottom up; dir itself stays, and so does a
 * folder changed after cutoff, which an app may be about to fill.
 */
async function removeEmpty(
  dir: string,
  keep: boolean,
  cutoff: number,
): Promise<boolean> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  let empty = true;
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (!(await removeEmpty(path.join(dir, entry.name), false, cutoff)))
        empty = false;
    } else empty = false;
  }
  if (!empty || keep) return false;
  try {
    if ((await fs.promises.lstat(dir)).mtimeMs > cutoff) return false;
    await fs.promises.rmdir(dir);
    return true;
  } catch {
    return false;
  }
}
