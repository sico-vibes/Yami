import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { unpackZip } from "./archive.ts";
import { engines as defaultEngines, type EngineId, type EngineSpec } from "./engine-catalog.ts";

export type CommandRunner = {
  run: (command: string, args: string[]) => Promise<void>;
};

async function walk(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else found.push(full);
  }
  return found;
}

function findExe(files: string[], name: string) {
  const matches = files.filter((file) => path.basename(file).toLowerCase() === name.toLowerCase());
  return (
    matches.find((file) => /x64|bin/i.test(file)) ||
    matches[0] ||
    ""
  );
}

export class EngineStore {
  constructor(
    private readonly root: string,
    private readonly specs: EngineSpec[] = defaultEngines,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly runner: CommandRunner = { async run() {} },
  ) {}

  list() {
    return this.specs.map((spec) => ({
      id: spec.id,
      version: spec.version,
      license: spec.license,
      installed: this.readyExe(spec) !== "",
    }));
  }

  async ensure(id: EngineId): Promise<string> {
    const spec = this.specs.find((item) => item.id === id);
    if (!spec) throw new Error("Unknown engine.");
    const cached = this.readyExe(spec);
    if (cached) return cached;
    const dir = path.join(this.root, spec.id, spec.version);
    const payload = path.join(dir, "payload");
    await fs.promises.rm(dir, { recursive: true, force: true });
    await fs.promises.mkdir(dir, { recursive: true });
    const response = await this.fetchImpl(spec.url);
    if (!response.ok) throw new Error(`${spec.id} download failed (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== spec.sha256) {
      await fs.promises.rm(dir, { recursive: true, force: true });
      throw new Error(`${spec.id} did not match its pinned checksum. It was not run.`);
    }
    await fs.promises.writeFile(payload, bytes);
    const filesDir = path.join(dir, "files");
    await fs.promises.mkdir(filesDir, { recursive: true });
    if (spec.format === "exe") {
      await fs.promises.copyFile(payload, path.join(filesDir, spec.exe));
    } else if (spec.format === "zip") {
      for (const entry of unpackZip(bytes)) {
        const target = path.join(filesDir, ...entry.name.split("/"));
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(target, entry.data);
      }
    } else {
      const extractor = await this.ensure("sevenZip");
      await this.runner.run(extractor, ["x", payload, `-o${filesDir}`, "-y"]);
    }
    let files = await walk(filesDir);
    if (spec.id === "exiftool" && !findExe(files, "exiftool.exe")) {
      const wrapped = files.find((file) => path.basename(file).toLowerCase() === "exiftool(-k).exe");
      if (wrapped) {
        const renamed = path.join(path.dirname(wrapped), "exiftool.exe");
        await fs.promises.copyFile(wrapped, renamed);
        files = await walk(filesDir);
      }
    }
    const exe = findExe(files, spec.exe);
    if (!exe) throw new Error(`${spec.id} downloaded, but ${spec.exe} was not inside.`);
    await fs.promises.writeFile(
      path.join(dir, "ready.json"),
      JSON.stringify({ sha256: spec.sha256, exe }),
    );
    return exe;
  }

  private readyExe(spec: EngineSpec) {
    try {
      const marker = JSON.parse(
        fs.readFileSync(path.join(this.root, spec.id, spec.version, "ready.json"), "utf8"),
      );
      if (marker.sha256 === spec.sha256 && fs.existsSync(marker.exe)) return String(marker.exe);
    } catch {}
    return "";
  }
}
