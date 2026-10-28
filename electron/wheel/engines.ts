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

export type EngineProgress = (received: number, total: number) => void;

export class EngineStore {
  // One download per engine, shared by the wheel and Settings › Modules.
  private pending = new Map<EngineId, Promise<string>>();

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

  busy(id: EngineId) {
    return this.pending.has(id);
  }

  ensure(id: EngineId, options: { signal?: AbortSignal; progress?: EngineProgress } = {}) {
    const spec = this.spec(id);
    const cached = this.readyExe(spec);
    if (cached) return Promise.resolve(cached);
    let job = this.pending.get(id);
    if (!job) {
      job = this.download(spec, options).finally(() => this.pending.delete(id));
      this.pending.set(id, job);
    }
    return job;
  }

  /** Installs from a file the user downloaded; the same pin applies. */
  async installFile(id: EngineId, file: string) {
    const spec = this.spec(id);
    if (this.pending.has(id)) throw new Error(`${spec.id} is already downloading.`);
    const bytes = await fs.promises.readFile(file);
    const job = this.install(spec, bytes).finally(() => this.pending.delete(id));
    this.pending.set(id, job);
    return job;
  }

  async remove(id: EngineId) {
    const spec = this.spec(id);
    if (this.pending.has(id)) throw new Error(`Wait for ${spec.id} to finish downloading.`);
    await fs.promises.rm(path.join(this.root, spec.id), { recursive: true, force: true });
  }

  private spec(id: EngineId) {
    const spec = this.specs.find((item) => item.id === id);
    if (!spec) throw new Error("Unknown engine.");
    return spec;
  }

  private async download(
    spec: EngineSpec,
    options: { signal?: AbortSignal; progress?: EngineProgress },
  ) {
    const response = await this.fetchImpl(spec.url, { signal: options.signal });
    if (!response.ok) throw new Error(`${spec.id} download failed (${response.status}).`);
    const total = Number(response.headers.get("content-length")) || 0;
    const chunks: Uint8Array[] = [];
    let received = 0;
    const reader = response.body?.getReader();
    if (reader)
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        options.progress?.(received, total);
      }
    else chunks.push(new Uint8Array(await response.arrayBuffer()));
    return this.install(spec, Buffer.concat(chunks));
  }

  private async install(spec: EngineSpec, bytes: Buffer): Promise<string> {
    const dir = path.join(this.root, spec.id, spec.version);
    const payload = path.join(dir, "payload");
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== spec.sha256)
      throw new Error(`${spec.id} did not match its pinned checksum. It was not run.`);
    await fs.promises.rm(dir, { recursive: true, force: true });
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(payload, bytes);
    const filesDir = path.join(dir, "files");
    await fs.promises.mkdir(filesDir, { recursive: true });
    if (spec.format === "exe" || spec.format === "file") {
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
