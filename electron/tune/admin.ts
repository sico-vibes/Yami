import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { psQuote } from "./dns.ts";

const exec = promisify(execFile);

// Tune's administrator section: a restore point, and two background
// services Yami can stop. Each change asks Windows for administrator
// approval once. A service's previous start type is saved first, so
// turning it back on restores exactly what it was.

export const adminServices = ["DiagTrack", "MapsBroker"] as const;
export type AdminService = {
  name: string;
  label: string;
  start: string;
  running: boolean;
  /** Stopped by Yami, with the start type to put back. */
  savedStart?: string;
};

/** The elevated command: only fixed words from Yami's list reach it. */
export function adminElevatedArgs(script: string, params: string[]) {
  const inner = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    `"${script}"`,
    ...params,
  ];
  return [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `$p = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList ${inner
      .map(psQuote)
      .join(",")}; exit $p.ExitCode`,
  ];
}

export class AdminController {
  constructor(
    private script: string,
    private stateFile: string,
  ) {}

  private saved(): Record<string, { start: string; running: boolean }> {
    try {
      return JSON.parse(fs.readFileSync(this.stateFile, "utf8"));
    } catch {
      return {};
    }
  }

  async list(): Promise<AdminService[]> {
    const { stdout } = await exec(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        this.script,
      ],
      { windowsHide: true, timeout: 20000 },
    );
    const result = JSON.parse(stdout.trim() || "{}");
    if (result.error) throw new Error(result.error);
    const saved = this.saved();
    return (result.services || []).map((s: any) => ({
      name: String(s.name),
      label: String(s.label),
      start: String(s.start),
      running: !!s.running,
      ...(saved[s.name] && { savedStart: saved[s.name].start }),
    }));
  }

  /** Runs one elevated step and returns what it wrote. */
  private async elevated(params: string[]) {
    const out = path.join(
      os.tmpdir(),
      `yami-admin-${process.pid}-${Date.now()}.json`,
    );
    try {
      await exec(
        "powershell.exe",
        adminElevatedArgs(this.script, [...params, "-Out", out]),
        {
          windowsHide: true,
          timeout: 180000,
        },
      );
    } catch (error) {
      const text = String(
        (error as { stderr?: string }).stderr || (error as Error).message,
      );
      if (/canceled by the user|cancelled/i.test(text))
        throw new Error(
          "Windows did not get administrator approval, so nothing changed.",
        );
    }
    let result: any = {};
    try {
      result = JSON.parse(fs.readFileSync(out, "utf8"));
    } catch {
      throw new Error(
        "Windows did not get administrator approval, so nothing changed.",
      );
    } finally {
      fs.rmSync(out, { force: true });
    }
    if (result.error) throw new Error(result.error);
    return result;
  }

  /** Stops a service (off) or puts back the start type it had (on). */
  async setService(name: unknown, off: unknown) {
    const id = String(name);
    if (!(adminServices as readonly string[]).includes(id))
      throw new Error("That service is not one Yami changes.");
    const current = (await this.list()).find((s) => s.name === id);
    if (!current) throw new Error("That service is not on this PC.");
    const saved = this.saved();
    if (off === true) {
      if (current.start === "Disabled") return this.list();
      saved[id] = { start: current.start, running: current.running };
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(saved));
      await this.elevated([
        "-Mode",
        "service",
        "-Name",
        id,
        "-Start",
        "Disabled",
      ]);
    } else {
      const back = saved[id] || { start: "Manual", running: false };
      await this.elevated([
        "-Mode",
        "service",
        "-Name",
        id,
        "-Start",
        back.start,
        "-Run",
        back.running ? "1" : "0",
      ]);
      delete saved[id];
      fs.writeFileSync(this.stateFile, JSON.stringify(saved));
    }
    return this.list();
  }

  async restorePoint() {
    const result = await this.elevated(["-Mode", "restore-point"]);
    return { created: !!result.created };
  }
}
