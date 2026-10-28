import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// SSH hosts for Yami Terminal's shell menu, read from ~/.ssh/config when the
// menu opens. Only plain aliases are offered (no wildcard patterns), and only
// names made of safe characters, since the alias is typed after "ssh ".

export const safeHost = (name: string) => /^[A-Za-z0-9._-]{1,64}$/.test(name);

/** The Host aliases in an OpenSSH config, in file order, without repeats. */
export function sshHosts(text: string) {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*Host\s+(.+?)\s*$/i.exec(raw);
    if (!m) continue;
    for (const name of m[1].split(/\s+/))
      if (!/[*?!]/.test(name) && safeHost(name) && !out.includes(name))
        out.push(name);
  }
  return out.slice(0, 50);
}

export function readSshHosts(home = os.homedir()) {
  try {
    return sshHosts(fs.readFileSync(path.join(home, ".ssh", "config"), "utf8"));
  } catch {
    return [];
  }
}
