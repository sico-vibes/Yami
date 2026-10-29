import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

// Tune › Hosts file: the names Windows answers itself before asking DNS.
// Reading needs no rights; each change asks Windows for administrator
// approval once, and the elevated script accepts only blank lines,
// comments and "address name" lines. Before Yami's first change the whole
// file is kept, so Put back restores it exactly.

export type HostsEntry = {
  /** Line number in the file, starting at 0. */
  line: number;
  ip: string;
  names: string[];
  on: boolean;
};

const hostName = /^[a-z0-9._-]{1,253}$/i;

/** "127.0.0.1 a b # note", or the same line commented out. */
export function parseHosts(text: string): HostsEntry[] {
  const out: HostsEntry[] = [];
  text.split(/\r?\n/).forEach((raw, line) => {
    const off = /^\s*#\s*/.exec(raw);
    const body = (off ? raw.slice(off[0].length) : raw).split("#")[0].trim();
    const [ip, ...names] = body.split(/\s+/);
    if (
      !ip ||
      !net.isIP(ip) ||
      !names.length ||
      !names.every((n) => hostName.test(n))
    )
      return;
    out.push({ line, ip, names, on: !off });
  });
  return out;
}

export class HostsController {
  constructor(
    private file: string,
    private backupFile: string,
    /** Writes the prepared file as administrator; tests write directly. */
    private write: (prepared: string) => Promise<unknown>,
  ) {}

  private read() {
    return fs.readFileSync(this.file, "utf8");
  }

  list() {
    return {
      entries: parseHosts(this.read()),
      changed: fs.existsSync(this.backupFile),
    };
  }

  private async save(lines: string[]) {
    const current = this.read();
    if (!fs.existsSync(this.backupFile))
      fs.writeFileSync(this.backupFile, current);
    const eol = current.includes("\r\n") ? "\r\n" : "\n";
    const prepared = path.join(
      os.tmpdir(),
      `yami-hosts-${process.pid}-${Date.now()}.txt`,
    );
    fs.writeFileSync(prepared, lines.join(eol));
    try {
      await this.write(prepared);
    } finally {
      fs.rmSync(prepared, { force: true });
    }
    return this.list();
  }

  private lines() {
    return this.read().split(/\r?\n/);
  }

  private entry(line: unknown) {
    const found = parseHosts(this.read()).find((e) => e.line === Number(line));
    if (!found)
      throw new Error("That hosts line changed. Open the list again.");
    return found;
  }

  async add(ip: unknown, name: unknown) {
    const address = String(ip || "").trim(),
      host = String(name || "")
        .trim()
        .toLowerCase();
    if (!net.isIP(address))
      throw new Error("Enter an address such as 127.0.0.1 or 0.0.0.0.");
    if (!hostName.test(host) || (!host.includes(".") && host !== "localhost"))
      throw new Error("Enter a host name such as ads.example.com.");
    const lines = this.lines();
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    lines.push(`${address}\t${host}`, "");
    return this.save(lines);
  }

  /** Comments a line out (off) or back in (on). */
  async toggle(line: unknown, on: unknown) {
    const e = this.entry(line);
    const lines = this.lines();
    lines[e.line] =
      on === true
        ? lines[e.line].replace(/^\s*#\s*/, "")
        : `# ${lines[e.line]}`;
    return this.save(lines);
  }

  async remove(line: unknown) {
    const e = this.entry(line);
    const lines = this.lines();
    lines.splice(e.line, 1);
    return this.save(lines);
  }

  /** Writes back the file as it was before Yami's first change. */
  async restore() {
    if (!fs.existsSync(this.backupFile))
      throw new Error("Yami has not changed the hosts file.");
    await this.save(fs.readFileSync(this.backupFile, "utf8").split(/\r?\n/));
    fs.rmSync(this.backupFile, { force: true });
    return this.list();
  }
}
