import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { shell } from "electron";
import { extensionOf, kindOf } from "../../src/wheel/catalog";
import { allocateFile, allocateFolder, stemOf, toolBase } from "../../src/wheel/naming";
import {
  compressAudioCommand,
  compressImageCommand,
  compressVideoCommand,
  compressVideoTargetCommand,
  convertCommand,
  editMetadataCommand,
  extractKind,
  stripMetadataCommand,
  videoTargetBitrate,
  type CompressPreset,
} from "../../src/wheel/plans";
import type { WheelFile } from "../../src/wheel/types";
import { packGzip, packTar, packZip, unpackGzip, unpackTar, unpackZip } from "./archive.ts";
import type { EngineStore } from "./engines.ts";
import { imagesToPdf, mergePdf } from "./pdf.ts";

let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>) {
  const run = chain.then(work, work);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function runProcess(
  command: string,
  args: string[],
  onText?: (text: string) => void,
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (text) => {
      stdout += text;
      onText?.(text);
    });
    child.stderr.on("data", (text) => {
      stderr += text;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function runChecked(command: string, args: string[], label: string, notify: (m: string) => void) {
  let bucket = 0;
  const result = await runProcess(command, args, (text) => {
    const fraction = progressFraction(text);
    if (fraction == null) return;
    const next = Math.ceil(fraction * 4);
    if (next <= bucket) return;
    bucket = next;
    notify(`${label} ${Math.min(100, Math.round(fraction * 100))}%`);
  });
  if (result.code !== 0)
    throw new Error(result.stderr.trim().split(/\r?\n/).at(-1) || `${label} failed.`);
  return result;
}

function progressFraction(text: string) {
  if (text.includes("progress=end")) return 1;
  return null;
}

async function writeEntries(folder: string, entries: { name: string; data: Buffer }[]) {
  for (const entry of entries) {
    const target = path.resolve(folder, ...entry.name.split("/"));
    const relative = path.relative(folder, target);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("The archive contains an unsafe path.");
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, entry.data);
  }
}

export async function performWheel(input: {
  petalId: string;
  files: WheelFile[];
  options?: any;
  engines: EngineStore;
  reveal: boolean;
  notify: (message: string) => void;
}) {
  return enqueue(() => performNow(input));
}

async function performNow(input: {
  petalId: string;
  files: WheelFile[];
  options?: any;
  engines: EngineStore;
  reveal: boolean;
  notify: (message: string) => void;
}) {
  const { files, notify, engines } = input;
  if (!files.length) throw new Error("Choose a file.");
  const outputs: string[] = [];
  const finish = async (saved: string[]) => {
    if (input.reveal && saved[0]) {
      try {
        shell.showItemInFolder(saved[0]);
      } catch {}
    }
    notify(saved.length === 1 ? `Saved ${path.basename(saved[0])}` : `Saved ${saved.length} files.`);
    return saved;
  };
  if (input.petalId === "tool:background" && input.options?.png) {
    const file = files[0];
    const output = allocateFile(
      path.dirname(file.path),
      toolBase(file.name, "Background"),
      "png",
      fs.existsSync,
    );
    await fs.promises.writeFile(output, decodePng(String(input.options.png)));
    return finish([output]);
  }
  if (input.petalId.startsWith("to:")) {
    const target = input.petalId.slice(3);
    for (const file of files) {
      if (extensionOf(file.name) === target || (target === "jpg" && extensionOf(file.name) === "jpeg"))
        continue;
      const output = allocateFile(path.dirname(file.path), stemOf(file.name), target, fs.existsSync);
      const command = convertCommand(kindOf(file.name), target, file.path, output);
      const exe = await engines.ensure(command.engine);
      notify(`Converting ${file.name}`);
      await runChecked(exe, command.args, file.name, notify);
      outputs.push(output);
    }
    if (!outputs.length) throw new Error("Those files are already in that format.");
    return finish(outputs);
  }
  if (input.petalId === "tool:compress") return finish(await compress(input));
  if (input.petalId === "tool:metadata") return finish(await metadata(input));
  if (input.petalId === "tool:extract") return finish(await extract(input));
  if (input.petalId === "tool:merge") return finish([await mergedPdf(input)]);
  if (input.petalId === "tool:pdf") return finish([await pagesPdf(input)]);
  throw new Error("That tool is not connected yet.");
}

async function compress(input: {
  files: WheelFile[];
  options?: any;
  engines: EngineStore;
  notify: (message: string) => void;
}) {
  const preset = (["smaller", "balanced", "smallest"].includes(input.options?.preset)
    ? input.options.preset
    : "balanced") as CompressPreset;
  const percent = Number(input.options?.percent) || 100;
  const outputs: string[] = [];
  for (const file of input.files) {
    const kind = kindOf(file.name);
    const directory = path.dirname(file.path);
    if (kind === "image" || kind === "gif") {
      const output = allocateFile(directory, toolBase(file.name, "Compressed"), file.ext || "jpg", fs.existsSync);
      const command = compressImageCommand(file.path, output, preset, percent);
      await runChecked(await input.engines.ensure("magick"), command.args, file.name, input.notify);
      outputs.push(output);
    } else if (kind === "audio" && !["wav", "flac", "aiff"].includes(file.ext)) {
      const output = allocateFile(directory, toolBase(file.name, "Compressed"), file.ext, fs.existsSync);
      const command = compressAudioCommand(file.path, output, preset);
      await runChecked(await input.engines.ensure("ffmpeg"), command.args, file.name, input.notify);
      outputs.push(output);
    } else if (kind === "video") {
      const output = allocateFile(directory, toolBase(file.name, "Compressed"), file.ext, fs.existsSync);
      const target = Number(input.options?.targetMb);
      let command = compressVideoCommand(file.path, output, preset);
      if (target > 0) {
        const ffmpeg = await input.engines.ensure("ffmpeg");
        const probe = path.join(path.dirname(ffmpeg), "ffprobe.exe");
        if (fs.existsSync(probe)) {
          const info = await runProcess(probe, [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            file.path,
          ]);
          const duration = Number(info.stdout.trim());
          if (duration > 0)
            command = compressVideoTargetCommand(file.path, output, videoTargetBitrate(target * 1_000_000, duration));
        }
      }
      await runChecked(await input.engines.ensure(command.engine), command.args, file.name, input.notify);
      outputs.push(output);
    } else {
      const output = allocateFile(directory, toolBase(file.name, "Compressed"), "zip", fs.existsSync);
      const data = await fs.promises.readFile(file.path);
      await fs.promises.writeFile(output, packZip([{ name: file.name, data }]));
      outputs.push(output);
    }
  }
  return outputs;
}

async function metadata(input: {
  files: WheelFile[];
  options?: any;
  engines: EngineStore;
  notify: (message: string) => void;
}) {
  const outputs: string[] = [];
  for (const file of input.files) {
    const output = allocateFile(
      path.dirname(file.path),
      toolBase(file.name, "No Metadata"),
      file.ext || "dat",
      fs.existsSync,
    );
    const command = input.options?.edits?.length
      ? editMetadataCommand(file.path, output, input.options.edits)
      : stripMetadataCommand(kindOf(file.name), file.path, output);
    await runChecked(await input.engines.ensure(command.engine), command.args, file.name, input.notify);
    outputs.push(output);
  }
  return outputs;
}

async function extract(input: { files: WheelFile[]; engines: EngineStore; notify: (message: string) => void }) {
  const folders: string[] = [];
  for (const file of input.files) {
    const folder = allocateFolder(path.dirname(file.path), `${stemOf(file.name)} Extracted`, fs.existsSync);
    await fs.promises.mkdir(folder, { recursive: true });
    const kind = extractKind(file.ext);
    if (kind === "zip") {
      await writeEntries(folder, unpackZip(await fs.promises.readFile(file.path)));
    } else if (kind === "tar") {
      await writeEntries(folder, unpackTar(await fs.promises.readFile(file.path)));
    } else if (kind === "gzip") {
      const raw = unpackGzip(await fs.promises.readFile(file.path));
      if (file.ext === "gz" && !file.name.toLowerCase().endsWith(".tar.gz")) {
        const inner = file.name.replace(/\.gz$/i, "");
        await fs.promises.writeFile(path.join(folder, path.basename(inner)), raw);
      } else await writeEntries(folder, unpackTar(raw));
    } else {
      const exe = await input.engines.ensure("sevenExtra");
      await runChecked(exe, ["x", file.path, `-o${folder}`, "-y"], file.name, input.notify);
    }
    folders.push(folder);
  }
  return folders;
}

async function mergedPdf(input: { files: WheelFile[]; options?: { order?: string[] } }) {
  const output = allocateFile(
    path.dirname(input.files[0].path),
    toolBase(input.files[0].name, "Merged"),
    "pdf",
    fs.existsSync,
  );
  const ordered = Array.isArray(input.options?.order)
    ? input.options.order.flatMap((item) => {
        const file = input.files.find((entry) => entry.path === item);
        return file ? [file] : [];
      })
    : input.files;
  await mergePdf(
    (ordered.length ? ordered : input.files).map((file) => file.path),
    output,
  );
  return output;
}

async function pagesPdf(input: { files: WheelFile[] }) {
  const output = allocateFile(
    path.dirname(input.files[0].path),
    toolBase(input.files[0].name, "Pages"),
    "pdf",
    fs.existsSync,
  );
  await imagesToPdf(input.files.map((file) => file.path), output);
  return output;
}

function decodePng(value: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) throw new Error("The background preview was not a PNG.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 8 || bytes.length > 25 * 1024 * 1024)
    throw new Error("That background image is too large.");
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    throw new Error("That background image is not a PNG.");
  return bytes;
}

export async function readMetadata(engines: EngineStore, file: string) {
  const installed = engines.list().find((item) => item.id === "exiftool")?.installed;
  if (!installed) throw new Error("ExifTool is not on this PC yet.");
  const exe = await engines.ensure("exiftool");
  const result = await runProcess(exe, ["-j", "-G", file]);
  if (result.code !== 0) throw new Error("ExifTool could not read that file.");
  const rows = JSON.parse(result.stdout || "[]");
  const record = rows[0] || {};
  return Object.entries(record)
    .filter(([key]) => key !== "SourceFile")
    .map(([tag, value]) => ({ tag, value: String(value) }));
}
