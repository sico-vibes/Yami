import fs from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { helperPath } from "../workbench/terminal";
import { TuneController } from "./tune";
import { readMachineKey, regExe } from "./registry";
import { StartupController } from "./startup";
import { DnsController } from "./dns";
import { AdminController } from "./admin";
import { AppsController } from "./apps";
import { CleanupController, nativeStats } from "./cleanup";
import { NetworkShield } from "./shield";
import { SpaceController } from "./space";
import { shell } from "electron";

export { shieldWanted } from "./shield";

/** The Tune module's main-process parts, built when it is first used. */
export type Tune = {
  tweaks: TuneController;
  startup: StartupController;
  dns: DnsController;
  admin: AdminController;
  apps: AppsController;
  cleanup: CleanupController;
  space: SpaceController;
  shield: NetworkShield;
};

export function loadTune(dataDir: string): Tune {
  // The sandbox root of the desktop check also hides machine entries and
  // uses its own Startup folder.
  const sandbox = process.env.YAMI_TUNE_ROOT;
  const io = regExe(sandbox);
  return {
    tweaks: new TuneController(path.join(dataDir, "tune.json"), io),
    startup: new StartupController(
      io,
      process.env.YAMI_TUNE_STARTUP_DIR ||
        path.join(
          process.env.APPDATA || "",
          "Microsoft",
          "Windows",
          "Start Menu",
          "Programs",
          "Startup",
        ),
      sandbox ? undefined : readMachineKey,
    ),
    dns: new DnsController(helperPath("Dns.ps1")),
    apps: new AppsController(helperPath("Apps.ps1")),
    cleanup: new CleanupController(
      undefined,
      nativeStats(helperPath("Yami.FileStats.exe")),
    ),
    space: new SpaceController(helperPath("Yami.FileStats.exe")),
    // YAMI_SHIELD_PORT moves it off port 53 for the desktop check.
    shield: new NetworkShield({
      dir: dataDir,
      port: Number(process.env.YAMI_SHIELD_PORT) || 53,
    }),
    admin: new AdminController(
      helperPath("Admin.ps1"),
      path.join(dataDir, "tune-admin.json"),
    ),
  };
}

/** Answers `tune.*` requests from the page. */
export function tuneRequest(t: Tune, method: string, a: any = {}) {
  if (method.startsWith("tune.shield")) return t.shield.request(method, a);
  if (method === "tune.space.drives") return t.space.drives();
  if (method === "tune.space") return t.space.list(a.folder);
  if (method === "tune.space.reveal") return reveal(a.folder, a.name);
  if (method === "tune.cleanup") return t.cleanup.scan();
  if (method === "tune.cleanup.run") return t.cleanup.clean(a.ids);
  if (method === "tune.apps") return t.apps.list();
  if (method === "tune.apps.uninstall") return t.apps.uninstall(a.id);
  if (method === "tune.admin") return t.admin.list();
  if (method === "tune.admin.service") return t.admin.setService(a.name, a.off);
  if (method === "tune.admin.restorePoint") return t.admin.restorePoint();
  if (method === "tune.dns") return t.dns.list();
  if (method === "tune.dns.set")
    return t.dns.set(a.index, a.profile, a.encrypted);
  if (method === "tune.list") return t.tweaks.list();
  if (method === "tune.apply") return t.tweaks.apply(a.ids);
  if (method === "tune.undo") return t.tweaks.undo(a.ids);
  if (method === "tune.startup") return t.startup.list();
  if (method === "tune.startup.set") return t.startup.set(a.id, a.enabled);
  if (method === "tune.restartExplorer") return restartExplorer();
  throw new Error("Unknown tune-up request.");
}

/** Shows a folder, or one entry of it, in File Explorer. */
async function reveal(folder: unknown, name: unknown) {
  const dir = path.resolve(String(folder || ""));
  const target = name ? path.join(dir, path.basename(String(name))) : dir;
  if (!path.isAbsolute(String(folder || "")) || !fs.existsSync(target))
    throw new Error("That is no longer on this PC.");
  if (name) shell.showItemInFolder(target);
  else {
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
  }
  return true;
}

/** Ends Explorer and starts it again if Windows did not. Asked for first. */
function restartExplorer() {
  return new Promise<boolean>((resolve) => {
    execFile(
      "taskkill.exe",
      ["/f", "/im", "explorer.exe"],
      { windowsHide: true, timeout: 8000 },
      () =>
        setTimeout(() => {
          execFile(
            "tasklist.exe",
            ["/fi", "imagename eq explorer.exe", "/nh"],
            { windowsHide: true, timeout: 8000 },
            (_e, stdout) => {
              if (!/explorer\.exe/i.test(String(stdout)))
                spawn("explorer.exe", [], {
                  detached: true,
                  stdio: "ignore",
                }).unref();
              resolve(true);
            },
          );
        }, 2000),
    );
  });
}
