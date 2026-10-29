import fs from "node:fs";
import path from "node:path";

// Known vulnerabilities in a project's npm packages, from OSV.dev (Google's
// open vulnerability database; free, no key). Only package names and
// exact versions from package-lock.json are sent, on request.

export type OsvFinding = {
  name: string;
  version: string;
  ids: string[];
};
export type OsvReport = {
  packages: number;
  findings: OsvFinding[];
  /** A one-line summary per advisory, for the first 25 advisories. */
  details: Record<string, string>;
  checkedAt: number;
};

const MAX_PACKAGES = 5000;

/** Every installed name@version in package-lock.json (lockfile v1–v3). */
export function lockPackages(lock: any): { name: string; version: string }[] {
  const out = new Map<string, { name: string; version: string }>();
  const add = (name: string, version: unknown) => {
    if (typeof version !== "string" || !/^\d+\.\d+\.\d+/.test(version)) return;
    if (!/^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i.test(name)) return;
    out.set(`${name}@${version}`, { name, version });
  };
  if (lock?.packages && typeof lock.packages === "object") {
    for (const [key, entry] of Object.entries<any>(lock.packages)) {
      if (!key || entry?.link) continue;
      const at = key.lastIndexOf("node_modules/");
      add(
        entry?.name || key.slice(at + "node_modules/".length),
        entry?.version,
      );
    }
  } else {
    const walk = (deps: any) => {
      for (const [name, entry] of Object.entries<any>(deps || {})) {
        add(name, entry?.version);
        walk(entry?.dependencies);
      }
    };
    walk(lock?.dependencies);
  }
  return [...out.values()].slice(0, MAX_PACKAGES);
}

export async function checkProject(
  folder: string,
  fetcher: typeof fetch = fetch,
): Promise<OsvReport> {
  const file = path.join(folder, "package-lock.json");
  let lock: unknown;
  try {
    lock = JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch {
    throw new Error("This project has no package-lock.json to check.");
  }
  const packages = lockPackages(lock);
  const findings: OsvFinding[] = [];
  for (let i = 0; i < packages.length; i += 1000) {
    const chunk = packages.slice(i, i + 1000);
    const response = await fetcher("https://api.osv.dev/v1/querybatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queries: chunk.map((p) => ({
          package: { name: p.name, ecosystem: "npm" },
          version: p.version,
        })),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("OSV.dev could not be reached.");
    const json: any = await response.json();
    (json.results || []).forEach((r: any, n: number) => {
      const ids = (r?.vulns || [])
        .map((v: any) => String(v.id))
        .filter(Boolean);
      if (ids.length) findings.push({ ...chunk[n], ids });
    });
  }
  // A short summary for the first advisories; the rest link to osv.dev.
  const details: Record<string, string> = {};
  const ids = [...new Set(findings.flatMap((f) => f.ids))].slice(0, 25);
  await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await fetcher(
          `https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`,
          { signal: AbortSignal.timeout(15000) },
        );
        const v: any = await r.json();
        details[id] = String(v.summary || v.details || "")
          .split("\n")[0]
          .slice(0, 200);
      } catch {}
    }),
  );
  return {
    packages: packages.length,
    findings,
    details,
    checkedAt: Date.now(),
  };
}
