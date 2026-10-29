import fs from "node:fs";
import type { RegistryIo, Stored } from "./registry.ts";

// Tune › Environment variables: your own (per-user) variables in
// HKCU\Environment, the ones Windows' "Edit environment variables for your
// account" dialog changes. No administrator rights. Before Yami's first
// change to a variable it keeps that variable's earlier value, so Put back
// restores exactly what was there, and Windows is told the variables
// changed so newly started apps see them.

const KEY = "Environment";

export type EnvVariable = { name: string; value: string; expand: boolean };

export class EnvController {
  constructor(
    private io: RegistryIo,
    private undoFile: string,
    /** Broadcasts WM_SETTINGCHANGE "Environment" (native host). */
    private announce: () => Promise<unknown> = async () => {},
  ) {}

  private saved(): Record<string, Stored | null> {
    try {
      return JSON.parse(fs.readFileSync(this.undoFile, "utf8"));
    } catch {
      return {};
    }
  }

  async list() {
    const values = await this.io.list(KEY);
    const variables: EnvVariable[] = Object.entries(values)
      .filter(([name, v]) => name !== "(Default)" && /SZ$/.test(v.type))
      .map(([name, v]) => ({
        name,
        value: v.data,
        expand: v.type === "REG_EXPAND_SZ",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { variables, changed: Object.keys(this.saved()) };
  }

  private async keep(name: string) {
    const saved = this.saved();
    const key = Object.keys(saved).find(
      (k) => k.toLowerCase() === name.toLowerCase(),
    );
    if (key) return;
    const all = await this.io.list(KEY);
    const before =
      all[
        Object.keys(all).find((k) => k.toLowerCase() === name.toLowerCase()) ||
          name
      ];
    saved[name] = before ? { type: before.type, data: before.data } : null;
    fs.writeFileSync(this.undoFile, JSON.stringify(saved));
  }

  /** Sets one variable; Path-like values keep their expandable type. */
  async set(a: { name?: unknown; value?: unknown }) {
    const name = String(a.name || "").trim();
    const value = String(a.value ?? "");
    if (!/^[A-Za-z_][A-Za-z0-9_().-]{0,254}$/.test(name))
      throw new Error("Use letters, digits and underscores for the name.");
    if (value.length > 32767)
      throw new Error("That value is too long for Windows.");
    if (/[\r\n\0]/.test(value))
      throw new Error("A value cannot contain line breaks.");
    const current = (await this.list()).variables.find(
      (v) => v.name.toLowerCase() === name.toLowerCase(),
    );
    await this.keep(current?.name || name);
    await this.io.write({
      key: KEY,
      name: current?.name || name,
      type: current?.expand || value.includes("%") ? "REG_EXPAND_SZ" : "REG_SZ",
      data: value,
    });
    await this.announce().catch(() => {});
    return this.list();
  }

  async remove(nameValue: unknown) {
    const current = (await this.list()).variables.find(
      (v) => v.name.toLowerCase() === String(nameValue || "").toLowerCase(),
    );
    if (!current) throw new Error("That variable is not set.");
    await this.keep(current.name);
    await this.io.deleteValue(KEY, current.name);
    await this.announce().catch(() => {});
    return this.list();
  }

  /** Writes back every variable Yami changed, exactly as it was. */
  async restore() {
    const saved = this.saved();
    if (!Object.keys(saved).length)
      throw new Error("Yami has not changed any variable.");
    for (const [name, before] of Object.entries(saved)) {
      if (before)
        await this.io.write({
          key: KEY,
          name,
          type: before.type as any,
          data: before.data,
        });
      else await this.io.deleteValue(KEY, name);
    }
    fs.rmSync(this.undoFile, { force: true });
    await this.announce().catch(() => {});
    return this.list();
  }
}
