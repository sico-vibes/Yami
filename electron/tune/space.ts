import fs from "node:fs";
import path from "node:path";
import { execFile, type ChildProcess } from "node:child_process";

// Tune › Disk space: each drive's used and free space, and what takes the
// room inside a folder, measured on request by Yami.FileStats.exe. One
// measurement runs at a time; opening another folder stops the last one.

export type SpaceDrive = { path: string; total: number; free: number };
export type SpaceItem = {
  name: string;
  dir: boolean;
  bytes: number;
  files: number;
  capped: boolean;
};
export type SpaceView = {
  folder: string;
  parent?: string;
  total: number;
  items: SpaceItem[];
  /** Entries beyond the largest ones, added up. */
  rest: { count: number; bytes: number };
};

const SHOWN = 60;

export class SpaceController {
  private running?: ChildProcess;
  private replaced = new WeakSet<ChildProcess>();
  constructor(private exe: string) {}

  async drives(): Promise<SpaceDrive[]> {
    const out: SpaceDrive[] = [];
    for (const letter of "CDEFGHIJKLMNOPQRSTUVWXYZ") {
      const root = `${letter}:\\`;
      try {
        const s = await fs.promises.statfs(root);
        const total = s.blocks * s.bsize;
        if (total > 0)
          out.push({ path: root, total, free: s.bavail * s.bsize });
      } catch {}
    }
    return out;
  }

  async list(folder: unknown): Promise<SpaceView> {
    const target = path.resolve(String(folder || ""));
    if (!path.isAbsolute(String(folder || "")))
      throw new Error("Choose a drive or folder.");
    const stat = await fs.promises.stat(target).catch(() => undefined);
    if (!stat?.isDirectory()) throw new Error("That folder is not on this PC.");
    if (!fs.existsSync(this.exe))
      throw new Error("Yami's folder reader is missing. Reinstall Yami.");
    this.stop(true);
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        this.exe,
        ["--children", target],
        {
          windowsHide: true,
          timeout: 10 * 60_000,
          maxBuffer: 32 * 1024 * 1024,
        },
        (error, out, err) => {
          if (this.running === child) this.running = undefined;
          if (this.replaced.has(child))
            reject(new Error("Stopped: another folder was opened."));
          else if (child.killed)
            reject(
              new Error("That folder took more than ten minutes to measure."),
            );
          else if (error)
            reject(
              new Error(String(err).trim() || "That folder could not be read."),
            );
          else resolve(out);
        },
      );
      this.running = child;
    });
    const items: SpaceItem[] = (JSON.parse(stdout).items || [])
      .map((i: any) => ({
        name: String(i.name),
        dir: !!i.dir,
        bytes: Number(i.bytes) || 0,
        files: Number(i.files) || 0,
        capped: !!i.capped,
      }))
      .sort((a: SpaceItem, b: SpaceItem) => b.bytes - a.bytes);
    const up = path.dirname(target);
    const rest = items.slice(SHOWN);
    return {
      folder: target,
      ...(up !== target && { parent: up }),
      total: items.reduce((n, i) => n + i.bytes, 0),
      items: items.slice(0, SHOWN),
      rest: {
        count: rest.length,
        bytes: rest.reduce((n, i) => n + i.bytes, 0),
      },
    };
  }

  stop(replacing = false) {
    if (this.running && replacing) this.replaced.add(this.running);
    this.running?.kill();
    this.running = undefined;
  }
}
