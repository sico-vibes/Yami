import { app } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
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

async function executeNativeScript(name: string) {
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
    ],
    { windowsHide: true, timeout: 15000 },
  );
  return JSON.parse(r.stdout.trim() || "{}");
}

const cache = new Map<string, { value: any; until: number }>();
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
