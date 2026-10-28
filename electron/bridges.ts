import fs from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

// Bridges to tools Yami does not bundle: RustDesk (AGPL remote desktop) and
// Windhawk (Explorer mods, which inject into other programs; Yami never
// does). Yami only finds them, reads what they saved, and starts them.
// Everything is read when a page asks; nothing watches in the background.

const exec = promisify(execFile);

/** Folders, overridable so the checks can use a fake install. */
export function bridgeRoots(env: NodeJS.ProcessEnv = process.env) {
  const root = env.YAMI_BRIDGE_ROOT;
  return {
    programFiles: root
      ? path.join(root, "Program Files")
      : env.ProgramFiles || "C:\\Program Files",
    appData: root ? path.join(root, "AppData") : env.APPDATA || "",
    programData: root
      ? path.join(root, "ProgramData")
      : env.ProgramData || "C:\\ProgramData",
    registry: !root,
  };
}

/** The simple `key = 'value'` lines RustDesk writes, by [section]. */
export function readToml(text: string) {
  const out: Record<string, Record<string, string>> = { "": {} };
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const head = /^\[([^\]]+)\]$/.exec(line);
    if (head) {
      section = head[1];
      out[section] ||= {};
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|(\S+))/.exec(
      line,
    );
    if (pair) out[section][pair[1]] = pair[2] ?? pair[3] ?? pair[4];
  }
  return out;
}

/** The `// ==WindhawkMod==` header of a mod's source. */
export function modHeader(text: string) {
  const field = (name: string) =>
    new RegExp(`^//\\s*@${name}\\s+(.+)$`, "m").exec(text)?.[1].trim() || "";
  return { id: field("id"), name: field("name"), version: field("version") };
}

/**
 * RustDesk's own config strings are base64-like text; nothing else passes,
 * and the first character can never make it look like another option.
 */
export const validRustdeskConfig = (value: string) =>
  /^[A-Za-z0-9][A-Za-z0-9+/=_.-]{15,3999}$/.test(value);

export const curatedMods = [
  {
    id: "windows-11-taskbar-styler",
    name: "Windows 11 Taskbar Styler",
  },
  {
    id: "windows-11-start-menu-styler",
    name: "Windows 11 Start Menu Styler",
  },
  {
    id: "windows-11-notification-center-styler",
    name: "Windows 11 Notification Center Styler",
  },
  {
    id: "taskbar-clock-customization",
    name: "Taskbar Clock Customization",
  },
];

export function createBridges(env: NodeJS.ProcessEnv = process.env) {
  const roots = () => bridgeRoots(env);
  const rustdeskExe = () =>
    path.join(roots().programFiles, "RustDesk", "rustdesk.exe");
  const windhawkExe = () =>
    path.join(roots().programFiles, "Windhawk", "windhawk.exe");
  const readText = (file: string) => {
    try {
      return fs.readFileSync(file, "utf8");
    } catch {
      return "";
    }
  };

  async function modDisabled(id: string) {
    if (!roots().registry) return undefined;
    try {
      const { stdout } = await exec(
        "reg.exe",
        [
          "query",
          `HKLM\\SOFTWARE\\Windhawk\\Engine\\Mods\\${id}`,
          "/v",
          "Disabled",
        ],
        { windowsHide: true, timeout: 4000 },
      );
      return /0x1\b/.test(stdout);
    } catch {
      return undefined;
    }
  }

  return {
    async rustdesk() {
      const exe = rustdeskExe();
      const config = path.join(roots().appData, "RustDesk", "config");
      const main = readToml(readText(path.join(config, "RustDesk.toml")));
      const options =
        readToml(readText(path.join(config, "RustDesk2.toml"))).options || {};
      return {
        installed: fs.existsSync(exe),
        id: main[""].id || "",
        idServer: options["custom-rendezvous-server"] || "",
        relayServer: options["relay-server"] || "",
        hasKey: !!options.key,
      };
    },
    /** Starts RustDesk, optionally importing a server config string. */
    async openRustdesk(configString?: unknown) {
      const exe = rustdeskExe();
      if (!fs.existsSync(exe)) throw new Error("RustDesk is not installed.");
      const args: string[] = [];
      if (configString !== undefined && configString !== "") {
        const value = String(configString).trim();
        if (!validRustdeskConfig(value))
          throw new Error(
            "Paste the config string from RustDesk's Network settings or your server's console.",
          );
        args.push("--config", value);
      }
      spawn(exe, args, { detached: true, stdio: "ignore" }).unref();
      return true;
    },
    async windhawk() {
      const exe = windhawkExe();
      const folder = path.join(roots().programData, "Windhawk", "ModsSource");
      let files: string[] = [];
      try {
        files = fs.readdirSync(folder).filter((f) => f.endsWith(".wh.cpp"));
      } catch {}
      const mods = await Promise.all(
        files.slice(0, 200).map(async (file) => {
          const head = modHeader(
            readText(path.join(folder, file)).slice(0, 4000),
          );
          const id = head.id || file.replace(/\.wh\.cpp$/, "");
          return {
            id,
            name: head.name || id,
            version: head.version,
            disabled: await modDisabled(id),
          };
        }),
      );
      return {
        installed: fs.existsSync(exe),
        mods: mods.sort((a, b) => a.name.localeCompare(b.name)),
        curated: curatedMods,
      };
    },
    async openWindhawk() {
      const exe = windhawkExe();
      if (!fs.existsSync(exe)) throw new Error("Windhawk is not installed.");
      spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
      return true;
    },
  };
}
