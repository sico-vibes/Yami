import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Installed apps in Tune. Uninstall runs the app's own registered
// uninstaller, the same one Settings › Apps starts; machine-wide apps then
// ask Windows for administrator approval themselves. The page only ever
// sends an id from the last list, never a command.

export type InstalledApp = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  sizeKb: number;
  user: boolean;
};

export class AppsController {
  private last = new Map<string, { name: string; uninstall: string }>();
  constructor(
    private script: string,
    /** Tests read a fake Uninstall key instead of the real ones. */
    private root = process.env.YAMI_APPS_ROOT || "",
  ) {}

  async list(): Promise<InstalledApp[]> {
    const { stdout } = await exec(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        this.script,
        ...(this.root ? ["-Root", this.root] : []),
      ],
      { windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 },
    );
    const result = JSON.parse(stdout.trim() || "{}");
    if (result.error) throw new Error(result.error);
    this.last.clear();
    const seen = new Set<string>();
    const apps: InstalledApp[] = [];
    for (const a of result.apps || []) {
      const id = createHash("sha1")
        .update(String(a.key))
        .digest("hex")
        .slice(0, 16);
      const dupe = `${a.name}\n${a.version}`;
      if (seen.has(dupe)) continue;
      seen.add(dupe);
      this.last.set(id, {
        name: String(a.name),
        uninstall: String(a.uninstall),
      });
      apps.push({
        id,
        name: String(a.name),
        publisher: String(a.publisher || ""),
        version: String(a.version || ""),
        sizeKb: Number(a.sizeKb) || 0,
        user: !!a.user,
      });
    }
    return apps.sort((x, y) => x.name.localeCompare(y.name));
  }

  /** Starts the app's own uninstaller; it shows its own window and questions. */
  uninstall(id: unknown) {
    const app = this.last.get(String(id));
    if (!app) throw new Error("Open the list again; that app is not in it.");
    const child = spawn(app.uninstall, {
      shell: true,
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.on("error", () => {});
    child.unref();
    return { started: app.name };
  }
}
