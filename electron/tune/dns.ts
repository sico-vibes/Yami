import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dnsProfiles, type DnsAdapter } from "../../src/tune-types.ts";

const exec = promisify(execFile);

/** Which profile a server list is, or "automatic" / "custom". */
export function profileOf(servers: string[]) {
  const found = dnsProfiles.find(
    (p) => p.servers.length && p.servers.every((s, i) => servers[i] === s),
  );
  return found?.id || "custom";
}

/** PowerShell single-quoted text: ' doubles, nothing else is special. */
export const psQuote = (value: string) => "'" + value.replace(/'/g, "''") + "'";

/** The elevated command: only a number and a profile id reach it. */
export function elevatedArgs(script: string, index: number, profile: string) {
  const inner = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    `"${script}"`,
    "-Mode",
    "apply",
    "-Index",
    String(index),
    "-Profile",
    profile,
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

/**
 * DNS per network adapter. Reading needs no rights; changing asks Windows for
 * administrator approval once per change. "Automatic" goes back to the
 * router's DNS (DHCP).
 */
export class DnsController {
  constructor(private script: string) {}

  async list(): Promise<DnsAdapter[]> {
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
    return (result.adapters || []).map((a: any) => {
      const servers = (a.servers || []).map(String);
      return {
        index: Number(a.index),
        name: String(a.name),
        description: String(a.description || ""),
        servers,
        profile: profileOf(servers),
      };
    });
  }

  async set(index: unknown, profile: unknown) {
    const n = Number(index);
    if (!Number.isInteger(n) || n <= 0)
      throw new Error("Choose a network adapter.");
    if (!(await this.list()).some((a) => a.index === n))
      throw new Error("That network adapter is not connected.");
    const id = String(profile);
    if (
      id !== "automatic" &&
      !dnsProfiles.some((p) => p.id === id && p.servers.length)
    )
      throw new Error("Choose a DNS profile.");
    try {
      await exec("powershell.exe", elevatedArgs(this.script, n, id), {
        windowsHide: true,
        timeout: 120000,
      });
    } catch (error) {
      const text = String(
        (error as { stderr?: string }).stderr || (error as Error).message,
      );
      throw new Error(
        /canceled by the user|cancelled/i.test(text)
          ? "Windows did not get administrator approval, so DNS was not changed."
          : "Windows could not change DNS for that adapter.",
      );
    }
    return this.list();
  }
}
