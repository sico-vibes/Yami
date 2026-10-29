import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

// Workspaces (the idea of PowerToys Workspaces): save which apps are open
// and where their windows sit, then put them back: windows that are open
// move to their place, apps that are closed start and then move. Only
// program paths and window places are kept, in workspaces.json.

type Saved = {
  exe: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
};
export type Workspace = {
  id: string;
  name: string;
  at: number;
  windows: Saved[];
};
type Live = Saved & { handle: number };
type Native = { call(method: string, args?: any): Promise<any> };

/** Hosts and shells that cannot be started again to the same window. */
const noLaunch =
  /\\(explorer|ApplicationFrameHost|SystemSettings|TextInputHost|ShellExperienceHost|SearchHost|StartMenuExperienceHost)\.exe$/i;

export class Workspaces {
  constructor(
    private file: string,
    private native: Native,
    private ownPid = process.pid,
    private launch: (exe: string) => void = (exe) =>
      spawn(exe, [], {
        detached: true,
        stdio: "ignore",
        cwd: path.dirname(exe),
      }).unref(),
    private sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  list(): Workspace[] {
    try {
      const all = JSON.parse(fs.readFileSync(this.file, "utf8"));
      return Array.isArray(all) ? all : [];
    } catch {
      return [];
    }
  }

  private write(all: Workspace[]) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(all));
  }

  private windows(): Promise<Live[]> {
    return this.native.call("appWindows", { skip: this.ownPid });
  }

  async save(name: unknown) {
    const label = String(name || "")
      .trim()
      .slice(0, 60);
    const windows = (await this.windows()).slice(0, 30);
    if (!windows.length) throw new Error("No app windows are open to save.");
    const all = this.list();
    const ws: Workspace = {
      id: Date.now().toString(36),
      name: label || `Workspace ${all.length + 1}`,
      at: Date.now(),
      windows: windows.map(({ handle: _h, ...w }) => w),
    };
    this.write([ws, ...all].slice(0, 10));
    return this.list();
  }

  remove(id: unknown) {
    this.write(this.list().filter((w) => w.id !== id));
    return this.list();
  }

  /** Moves open windows into place and starts apps that are closed. */
  async restore(id: unknown) {
    const ws = this.list().find((w) => w.id === id);
    if (!ws) throw new Error("That workspace is not saved.");
    let live = await this.windows();
    const used = new Set<number>();
    const pick = (s: Saved) => {
      const same = live.filter(
        (w) =>
          !used.has(w.handle) && w.exe.toLowerCase() === s.exe.toLowerCase(),
      );
      return same.find((w) => w.title === s.title) || same[0];
    };
    const result = { moved: 0, started: 0, missing: [] as string[] };
    const waiting: Saved[] = [];
    for (const s of ws.windows) {
      const w = pick(s);
      if (w) {
        used.add(w.handle);
        await this.native.call("placeWindow", { handle: w.handle, ...s });
        result.moved++;
      } else if (
        !noLaunch.test(s.exe) &&
        fs.existsSync(s.exe) &&
        !waiting.some((x) => x.exe === s.exe)
      ) {
        this.launch(s.exe);
        waiting.push(s);
        result.started++;
      } else result.missing.push(path.basename(s.exe, ".exe"));
    }
    // Apps just started get up to ten seconds to show a window.
    for (let i = 0; i < 20 && waiting.length; i++) {
      await this.sleep(500);
      live = await this.windows();
      for (const s of [...waiting]) {
        const w = pick(s);
        if (!w) continue;
        used.add(w.handle);
        await this.native.call("placeWindow", { handle: w.handle, ...s });
        waiting.splice(waiting.indexOf(s), 1);
      }
    }
    result.missing.push(...waiting.map((s) => path.basename(s.exe, ".exe")));
    return result;
  }
}
