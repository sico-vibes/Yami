import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RegValue } from "../../src/tune-types.ts";

const exec = promisify(execFile);
export type Stored = { type: string; data: string };

/** Per-user registry access through reg.exe, with argument arrays only. */
export type RegistryIo = {
  read(key: string, name: string): Promise<Stored | null>;
  keyExists(key: string): Promise<boolean>;
  write(value: RegValue): Promise<void>;
  deleteValue(key: string, name: string): Promise<void>;
  deleteKey(key: string): Promise<void>;
  /** Every value of a key, by name; empty when the key is missing. */
  list(key: string): Promise<Record<string, Stored>>;
};

/** One value from `reg query` output; DWORDs come back as decimal. */
export function parseRegQuery(stdout: string, name: string): Stored | null {
  const want = name || "(Default)";
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^ {4}(.+?) {4}(REG_[A-Z_]+)(?: {4}(.*))?$/.exec(line);
    if (!match || match[1] !== want) continue;
    const [, , type, raw = ""] = match;
    return {
      type,
      data: type === "REG_DWORD" ? String(parseInt(raw, 16)) : raw,
    };
  }
  return null;
}

/** Every value in `reg query` output for one key, by name. */
export function parseRegValues(stdout: string) {
  const out: Record<string, Stored> = {};
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^ {4}(.+?) {4}(REG_[A-Z_]+)(?: {4}(.*))?$/.exec(line);
    if (!match) continue;
    const [, name, type, raw = ""] = match;
    out[name] = {
      type,
      data: type === "REG_DWORD" ? String(parseInt(raw, 16)) : raw,
    };
  }
  return out;
}

/** Machine-wide values, read-only; used to list all-users startup apps. */
export async function readMachineKey(key: string) {
  try {
    const { stdout } = await exec("reg.exe", ["query", "HKLM\\" + key], {
      windowsHide: true,
      timeout: 10000,
    });
    return parseRegValues(stdout);
  } catch {
    return {};
  }
}

export function sameValue(stored: Stored | null, value: RegValue) {
  return !!stored && stored.type === value.type && stored.data === value.data;
}

/**
 * `root` moves every key under another HKCU key; the desktop check uses it to
 * stay inside a sandbox instead of the real settings.
 */
export function regExe(root = ""): RegistryIo {
  const full = (key: string) =>
    "HKCU\\" + (root ? root.replace(/\\+$/, "") + "\\" : "") + key;
  const named = (name: string) => (name ? ["/v", name] : ["/ve"]);
  const run = (args: string[]) =>
    exec("reg.exe", args, { windowsHide: true, timeout: 10000 });
  return {
    async read(key, name) {
      try {
        const { stdout } = await run(["query", full(key), ...named(name)]);
        return parseRegQuery(stdout, name);
      } catch {
        return null;
      }
    },
    async keyExists(key) {
      try {
        await run(["query", full(key)]);
        return true;
      } catch {
        return false;
      }
    },
    async write(value) {
      await run([
        "add",
        full(value.key),
        ...named(value.name),
        "/t",
        value.type,
        "/d",
        value.data,
        "/f",
      ]);
    },
    async deleteValue(key, name) {
      try {
        await run(["delete", full(key), ...named(name), "/f"]);
      } catch {}
    },
    async list(key) {
      try {
        const { stdout } = await run(["query", full(key)]);
        return parseRegValues(stdout);
      } catch {
        return {};
      }
    },
    async deleteKey(key) {
      try {
        await run(["delete", full(key), "/f"]);
      } catch {}
    },
  };
}
