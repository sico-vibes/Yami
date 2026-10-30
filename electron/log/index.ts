import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, dialog, shell } from "electron";
import { createLogCore, type Channel, type LogCore } from "./core";

// Wires Yami's logs (see core.ts) into the app: crashes, failed requests,
// renderer errors and the Windows helper. Everything here is cheap at idle:
// nothing is written unless something happens.

let core: LogCore | undefined;
let context: () => Record<string, unknown> = () => ({});
let debug = () => false;

/** The logger; created on first use under the data folder's "logs". */
export function log(): LogCore {
  core ||= createLogCore({
    dir: path.join(app.getPath("userData"), "logs"),
    home: os.homedir(),
    version: app.getVersion(),
    context: () => ({
      packaged: app.isPackaged,
      windows: BrowserWindow.getAllWindows()
        .filter((w) => !w.isDestroyed())
        .map(
          (w) =>
            new URL(w.webContents.getURL() || "about:blank").searchParams.get(
              "window",
            ) || "other",
        ),
      ...context(),
    }),
    debug: () => debug(),
  });
  return core;
}

/**
 * Facts the main process adds to every triage entry (such as modules on),
 * and whether debug logging is on.
 */
export function setLogContext(
  get: () => Record<string, unknown>,
  debugOn: () => boolean,
) {
  context = get;
  debug = debugOn;
}

// Errors that mean a bug in Yami, rather than a message for the user.
const bug = (e: unknown) =>
  e instanceof TypeError ||
  e instanceof ReferenceError ||
  e instanceof RangeError ||
  e instanceof SyntaxError;

/** Hooks crash and failure events. Call once, right after the data folder is set. */
export function installLogging() {
  let ready = false;
  process.on("uncaughtException", (e) => {
    log().error("main", e, { kind: "uncaught exception" }, true);
    // Before the app is up Yami cannot run; say where the details are.
    if (!ready) {
      dialog.showErrorBox(
        "Yami could not start",
        `${e.message}\n\nThe details were saved in ${log().dir}. You can attach the newest .ERR file to a bug report.`,
      );
      app.exit(1);
    }
  });
  process.on("unhandledRejection", (e) =>
    log().error("main", e, { kind: "unhandled rejection" }),
  );
  app.on("render-process-gone", (_e, contents, details) =>
    log().error(
      "renderer",
      new Error(`A window's page stopped: ${details.reason}`),
      {
        window: windowName(contents.getURL()),
        exitCode: details.exitCode,
      },
    ),
  );
  app.on("child-process-gone", (_e, details) => {
    if (details.reason !== "clean-exit")
      log().error(
        "process",
        new Error(`${details.type} process stopped: ${details.reason}`),
        {
          name: details.name,
          exitCode: details.exitCode,
        },
      );
  });
  app.on("browser-window-created", (_e, w) => {
    w.on("unresponsive", () =>
      log().info("window", "A window stopped responding", {
        window: windowName(w.webContents.getURL()),
      }),
    );
  });
  app.whenReady().then(() => {
    ready = true;
    log().info("app", "Yami started", {
      version: app.getVersion(),
      packaged: app.isPackaged,
      windows: os.release(),
      arch: process.arch,
      electron: process.versions.electron,
      memoryGB: Math.round(os.totalmem() / 1024 ** 3),
    });
  });
  app.on("will-quit", () => log().info("app", "Yami quit"));
}

const windowName = (url: string) => {
  try {
    return new URL(url).searchParams.get("window") || "other";
  } catch {
    return "other";
  }
};

/**
 * Wraps the renderer request handler: every request is timed in DEG, slow
 * ones are noted in LOG, refusals in LOG and bugs in ERR with triage.
 */
export function logged<A extends unknown[]>(
  handler: (
    event: Electron.IpcMainInvokeEvent,
    method: string,
    ...rest: A
  ) => Promise<unknown>,
) {
  return async (
    event: Electron.IpcMainInvokeEvent,
    method: string,
    ...rest: A
  ) => {
    const start = performance.now();
    try {
      const result = await handler(event, method, ...rest);
      const ms = Math.round(performance.now() - start);
      if (ms > 2000) log().info("request", `${method} took ${ms} ms`);
      log().debugLog("request", method, { ms });
      return result;
    } catch (e) {
      const ms = Math.round(performance.now() - start);
      if (bug(e)) log().error("request", e, { method, ms });
      else
        log().info("request", `${method} failed`, {
          error: e instanceof Error ? e.message : String(e),
          ms,
        });
      throw e;
    }
  };
}

/** Writes a CLT report (see core.ts) and returns its path. */
export async function collectReport(
  note: string | undefined,
  settings: unknown,
) {
  const l = log();
  await l.flush();
  return l.collect({
    note: note?.slice(0, 2000),
    settings,
    system: {
      windows: os.release(),
      arch: process.arch,
      electron: process.versions.electron,
      memoryGB: Math.round(os.totalmem() / 1024 ** 3),
      uptimeMinutes: Math.round(process.uptime() / 60),
    },
  });
}

/** A short summary for agents: version, context and the problems seen. */
export function logStatus() {
  return {
    version: app.getVersion(),
    packaged: app.isPackaged,
    windowsVersion: os.release(),
    uptimeMinutes: Math.round(process.uptime() / 60),
    debugLogging: debug(),
    logsFolder: log().dir,
    ...context(),
    problems: log().problems(),
  };
}

// A page reports at most 20 errors a minute.
const reports = new Map<number, { at: number; count: number }>();

/** Requests from the windows and the settings page. */
export async function logRequest(
  method: string,
  a: any,
  sender: Electron.WebContents,
  extra: { settings: () => unknown },
) {
  const l = log();
  switch (method) {
    case "log.report": {
      const r = reports.get(sender.id);
      const now = Date.now();
      if (r && now - r.at < 60_000 && r.count >= 20) return false;
      reports.set(
        sender.id,
        r && now - r.at < 60_000
          ? { at: r.at, count: r.count + 1 }
          : { at: now, count: 1 },
      );
      const e = new Error(
        String(a?.message || "Error in a window").slice(0, 1000),
      );
      e.name = String(a?.name || "Error").slice(0, 60);
      e.stack = String(a?.stack || e.stack).slice(0, 6000);
      l.error("page", e, {
        window: windowName(sender.getURL()),
        source: String(a?.source || "").slice(0, 200),
      });
      return true;
    }
    case "log.open":
      await l.flush();
      return shell.openPath(l.dir);
    case "log.collect": {
      const file = await collectReport(
        typeof a?.note === "string" ? a.note : undefined,
        extra.settings(),
      );
      if (a?.reveal !== false) shell.showItemInFolder(file);
      return { file };
    }
    case "log.read": {
      const channel = (["LOG", "ERR", "DEG", "TRG"] as Channel[]).includes(
        a?.channel,
      )
        ? a.channel
        : "ERR";
      await l.flush();
      return l.read(
        channel,
        Math.min(500, Math.max(1, Number(a?.limit) || 100)),
        typeof a?.since === "string" ? a.since : undefined,
      );
    }
    case "log.problems":
      return l.problems();
  }
  throw new Error("Unknown log request.");
}
