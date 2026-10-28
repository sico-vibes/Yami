import fs from "node:fs";
import type { StartupApp } from "../../src/tune-types.ts";
import type { RegistryIo, Stored } from "./registry.ts";

const run = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const approved =
  "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved";

/** Task Manager's rule: an even first byte is on, an odd one is off. */
export function approvedOn(value: Stored | undefined) {
  if (!value || value.type !== "REG_BINARY" || value.data.length < 2)
    return true;
  return parseInt(value.data.slice(0, 2), 16) % 2 === 0;
}

/** The bytes Task Manager writes: 02 and zeros, or 03 and the time it was turned off. */
export function approvalBytes(enabled: boolean, now = Date.now()) {
  if (enabled) return "02" + "00".repeat(11);
  const ticks = (BigInt(now) + 11644473600000n) * 10000n;
  let hex = "";
  for (let i = 0n; i < 8n; i++)
    hex += ((ticks >> (8n * i)) & 0xffn).toString(16).padStart(2, "0");
  return "03000000" + hex;
}

/**
 * Startup apps from your account's Run key and Startup folder, which you can
 * switch off and on without administrator rights, plus all-users entries
 * shown read-only. Switching off writes the same StartupApproved entry Task
 * Manager does, so nothing is deleted.
 */
export class StartupController {
  constructor(
    private io: RegistryIo,
    private folder: string,
    private machine: (
      key: string,
    ) => Promise<Record<string, Stored>> = async () => ({}),
  ) {}

  async list(): Promise<StartupApp[]> {
    const [user, userOk, folderOk, machine, machineOk] = await Promise.all([
      this.io.list(run),
      this.io.list(approved + "\\Run"),
      this.io.list(approved + "\\StartupFolder"),
      this.machine("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run"),
      this.machine(approved.replace("Software", "SOFTWARE") + "\\Run"),
    ]);
    const apps: StartupApp[] = [];
    for (const [name, value] of Object.entries(user))
      apps.push({
        id: "user:" + name,
        name,
        command: value.data,
        source: "user",
        enabled: approvedOn(userOk[name]),
        editable: true,
      });
    let files: string[] = [];
    try {
      files = fs
        .readdirSync(this.folder)
        .filter((f) => !/^desktop\.ini$/i.test(f));
    } catch {}
    for (const file of files)
      apps.push({
        id: "folder:" + file,
        name: file.replace(/\.(lnk|url|bat|cmd|exe)$/i, ""),
        command: file,
        source: "folder",
        enabled: approvedOn(folderOk[file]),
        editable: true,
      });
    for (const [name, value] of Object.entries(machine))
      apps.push({
        id: "machine:" + name,
        name,
        command: value.data,
        source: "machine",
        enabled: approvedOn(machineOk[name]),
        editable: false,
      });
    return apps.sort((a, b) => a.name.localeCompare(b.name));
  }

  async set(id: unknown, enabled: unknown) {
    if (typeof enabled !== "boolean") throw new Error("Choose on or off.");
    const app = (await this.list()).find((a) => a.id === id);
    if (!app) throw new Error("That startup app is gone.");
    if (!app.editable)
      throw new Error("All-users startup apps need administrator rights.");
    const name = app.source === "folder" ? app.command : app.name;
    await this.io.write({
      key: approved + (app.source === "folder" ? "\\StartupFolder" : "\\Run"),
      name,
      type: "REG_BINARY",
      data: approvalBytes(enabled),
    });
    return this.list();
  }
}
