import fs from "node:fs";
import type { RegistryIo, Stored } from "./registry.ts";

// Tune › Mouse pointer: the pointer schemes Windows lists in Mouse settings
// and the pointer size from Settings › Accessibility. Yami writes the same
// per-user values those pages write, keeps the earlier ones for an exact
// Put back, and asks Windows to reload the pointers.

/** The order of the paths in a scheme, as Windows' Mouse settings use it. */
export const cursorRoles = [
  "Arrow",
  "Help",
  "AppStarting",
  "Wait",
  "Crosshair",
  "IBeam",
  "NWPen",
  "No",
  "SizeNS",
  "SizeWE",
  "SizeNWSE",
  "SizeNESW",
  "SizeAll",
  "UpArrow",
  "Hand",
  "Pin",
  "Person",
] as const;

const KEY = "Control Panel\\Cursors";
const ACCESS = "Software\\Microsoft\\Accessibility";
const MACHINE =
  "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Control Panel\\Cursors\\Schemes";
/** Settings' size 1 is 32 pixels; each step adds 16. */
export const baseSize = (size: number) => 32 + (size - 1) * 16;

export type CursorScheme = { id: string; name: string; paths: string[] };
export type CursorStatus = {
  schemes: { id: string; name: string }[];
  current: string;
  size: number;
  /** Yami holds the values from before its first change. */
  saved: boolean;
};
type Snapshot = Record<string, Stored | null>;

export class CursorController {
  constructor(
    private io: RegistryIo,
    private machine: (key: string) => Promise<Record<string, Stored>>,
    private undoFile: string,
    private reload: () => Promise<unknown>,
  ) {}

  async schemes(): Promise<CursorScheme[]> {
    const out: CursorScheme[] = [];
    const add = (source: string, all: Record<string, Stored>) => {
      for (const [name, v] of Object.entries(all)) {
        if (name === "(Default)") continue;
        // Windows' own default set is listed as Windows Aero.
        const shown =
          source === "system" && name === "Windows Aero"
            ? "Windows Default"
            : name;
        out.push({
          id: `${source}:${name}`,
          name: shown,
          paths: v.data.split(","),
        });
      }
    };
    add("system", await this.machine(MACHINE));
    add("user", await this.io.list(KEY + "\\Schemes"));
    return out.sort((a, b) =>
      a.name === "Windows Default"
        ? -1
        : b.name === "Windows Default"
          ? 1
          : a.name.localeCompare(b.name),
    );
  }

  async status(): Promise<CursorStatus> {
    const values = await this.io.list(KEY);
    const size = Number((await this.io.read(ACCESS, "CursorSize"))?.data);
    const fromBase =
      Math.round((Number(values.CursorBaseSize?.data || 32) - 32) / 16) + 1;
    return {
      schemes: (await this.schemes()).map(({ id, name }) => ({ id, name })),
      current: values["(Default)"]?.data || "Windows Default",
      size:
        Number.isInteger(size) && size >= 1 && size <= 15
          ? size
          : Math.min(15, Math.max(1, fromBase)),
      saved: fs.existsSync(this.undoFile),
    };
  }

  /** The values a change touches, saved once before Yami's first change. */
  private async snapshot() {
    if (fs.existsSync(this.undoFile)) return;
    const values = await this.io.list(KEY);
    const snap: Snapshot = {};
    for (const name of [
      ...cursorRoles,
      "(Default)",
      "Scheme Source",
      "CursorBaseSize",
    ])
      snap[name] =
        values[name] && values[name].data !== "(value not set)"
          ? values[name]
          : null;
    snap["Accessibility:CursorSize"] = await this.io.read(ACCESS, "CursorSize");
    fs.writeFileSync(this.undoFile, JSON.stringify(snap));
  }

  async apply(a: { scheme?: unknown; size?: unknown }) {
    const scheme =
      a.scheme === undefined
        ? undefined
        : (await this.schemes()).find((s) => s.id === a.scheme);
    if (a.scheme !== undefined && !scheme)
      throw new Error("Choose a pointer scheme.");
    const size = a.size === undefined ? undefined : Number(a.size);
    if (
      size !== undefined &&
      !(Number.isInteger(size) && size >= 1 && size <= 15)
    )
      throw new Error("Choose a size from 1 to 15.");
    await this.snapshot();
    if (scheme) {
      for (const [i, role] of cursorRoles.entries())
        await this.io.write({
          key: KEY,
          name: role,
          type: "REG_EXPAND_SZ",
          data: scheme.paths[i] || "",
        });
      await this.io.write({
        key: KEY,
        name: "",
        type: "REG_SZ",
        data: scheme.name,
      });
      await this.io.write({
        key: KEY,
        name: "Scheme Source",
        type: "REG_DWORD",
        data: scheme.id.startsWith("user:") ? "1" : "2",
      });
    }
    if (size !== undefined) {
      await this.io.write({
        key: ACCESS,
        name: "CursorSize",
        type: "REG_DWORD",
        data: String(size),
      });
      await this.io.write({
        key: KEY,
        name: "CursorBaseSize",
        type: "REG_DWORD",
        data: String(baseSize(size)),
      });
    }
    await this.reload().catch(() => {});
    return this.status();
  }

  /** Writes back exactly what was there before Yami's first change. */
  async restore() {
    let snap: Snapshot;
    try {
      snap = JSON.parse(fs.readFileSync(this.undoFile, "utf8"));
    } catch {
      throw new Error("Yami has not changed the pointer.");
    }
    for (const [slot, stored] of Object.entries(snap)) {
      const [key, name] = slot.startsWith("Accessibility:")
        ? [ACCESS, slot.slice("Accessibility:".length)]
        : [KEY, slot === "(Default)" ? "" : slot];
      if (stored)
        await this.io.write({
          key,
          name,
          type: stored.type as any,
          data: stored.data,
        });
      else await this.io.deleteValue(key, name);
    }
    fs.rmSync(this.undoFile, { force: true });
    await this.reload().catch(() => {});
    return this.status();
  }
}
