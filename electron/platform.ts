import { app } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
const exec = promisify(execFile);
export function runPowerShell(
  script: string,
  args: string[] = [],
  timeout = 15000,
) {
  return exec(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
      ...args,
    ],
    { windowsHide: true, timeout, maxBuffer: 12 * 1024 * 1024 },
  );
}

async function executeNativeScript(name: string, args: string[] = []) {
  const script = app.isPackaged
    ? path.join(process.resourcesPath, "native", name + ".ps1")
    : path.join(app.getAppPath(), "native", name + ".ps1");
  const r = await exec(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      ...args,
    ],
    { windowsHide: true, timeout: 15000 },
  );
  return JSON.parse(r.stdout.trim() || "{}");
}

/**
 * File names from Windows Search under the user's folder, for the launcher.
 * Quotes, wildcards and brackets are dropped before the query reaches it.
 */
export async function windowsSearch(query: string) {
  const words = query
    .replace(/['"*%[\]]/g, " ")
    .trim()
    .slice(0, 80);
  if (words.length < 3) return [];
  const found = await executeNativeScript("Search", [
    "-Query",
    words,
    "-Scope",
    os.homedir(),
  ]).catch(() => []);
  return (Array.isArray(found) ? found : [])
    .filter(
      (f: any) => typeof f?.path === "string" && typeof f?.name === "string",
    )
    .slice(0, 20) as { name: string; path: string }[];
}

const cache = new Map<string, { value: any; until: number }>();
export const mediaActions = [
  "toggle",
  "next",
  "previous",
  "seek",
  "shuffle",
  "repeat",
] as const;
/** Acts on the playing app's media session, then refreshes the cache. */
export async function mediaAction(action: string, seconds = 0) {
  if (!mediaActions.includes(action as (typeof mediaActions)[number]))
    throw new Error("Unknown media action.");
  const at = Math.max(0, Math.min(86400, Number(seconds) || 0));
  // The player last shown, so the button acts on what the user saw.
  const shown = String(cache.get("Media")?.value?.app || "");
  const value = await executeNativeScript("Media", [
    "-Action",
    action,
    "-Seconds",
    String(at),
    ...(shown ? ["-App", shown] : []),
  ]);
  if (value.error) throw new Error(value.error);
  cache.set("Media", { value, until: Date.now() + 6000 });
  return value;
}
const pending = new Map<string, Promise<any>>();
export function nativeScript(name: string): Promise<any> {
  const cached = cache.get(name);
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.value);
  const running = pending.get(name);
  if (running) return running;
  const request = executeNativeScript(name)
    .then((value) => {
      const ttl = name === "Media" ? (value.active ? 6000 : 30000) : 4000;
      cache.set(name, { value, until: Date.now() + ttl });
      return value;
    })
    .finally(() => pending.delete(name));
  pending.set(name, request);
  return request;
}
