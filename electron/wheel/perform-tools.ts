import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  bleepCommand,
  channelsCommand,
  concatList,
  joinCommand,
  muteCommand,
  normalizeApplyCommand,
  normalizeCommand,
  normalizeMeasureCommand,
  parseLoudnorm,
  silenceTrimCommand,
  snapshotCommand,
  speedCommand,
  splitCommand,
  trimCommand,
  videoCropCommand,
  videoRedactCommand,
  visualizerCommand,
  type Loudness,
  type RedactBox,
} from "../../src/wheel/media-plans.ts";
import {
  allocateFile,
  allocateFolder,
  stemOf,
  toolBase,
} from "../../src/wheel/naming.ts";
import type { WheelFile } from "../../src/wheel/types";
import type { EngineStore } from "./engines.ts";
import { organizePdf, splitPdf, type PageEdit } from "./pdf-pages.ts";
import { decodePng, runChecked, runProcess } from "./spawn.ts";

const CANVAS: Record<string, string> = {
  "tool:background": "Background",
  "tool:adjust": "Edited",
  "tool:markup": "Annotated",
  "tool:crop": "Cropped",
  "tool:redact": "Redacted",
  "tool:collage": "Collage",
};

type Job = {
  petalId: string;
  files: WheelFile[];
  options?: Record<string, unknown>;
  engines: EngineStore;
  notify: (message: string) => void;
};

export async function performTool(
  input: Job,
  finish: (saved: string[]) => Promise<string[]>,
) {
  const canvas = CANVAS[input.petalId];
  if (canvas) {
    const file = input.files[0];
    if (!file) throw new Error("Choose a file.");
    const output = allocateFile(
      path.dirname(file.path),
      toolBase(file.name, canvas),
      "png",
      fs.existsSync,
    );
    await fs.promises.writeFile(
      output,
      decodePng(String(input.options?.png || "")),
    );
    return finish([output]);
  }
  if (input.petalId === "tool:mute")
    return finish(
      await each(input, "Muted", (file, output) =>
        muteCommand(file.path, output),
      ),
    );
  if (input.petalId === "tool:trim") return finish(await trim(input));
  if (input.petalId === "tool:video-crop") return finish(await crop(input));
  if (input.petalId === "tool:speed") return finish(await speed(input));
  if (input.petalId === "tool:join") return finish([await join(input)]);
  if (input.petalId === "tool:snapshots")
    return finish(await burst(input, "Snapshots", snapshotCommand));
  if (input.petalId === "tool:split")
    return finish(await burst(input, "Clips", splitCommand));
  if (input.petalId === "tool:video-redact") return finish(await redact(input));
  if (input.petalId === "tool:normalize") return finish(await normalize(input));
  if (input.petalId === "tool:channels") return finish(await channels(input));
  if (input.petalId === "tool:bleep") return finish(await bleep(input));
  if (input.petalId === "tool:visualizer")
    return finish(await visualizer(input));
  if (input.petalId === "tool:pdf-split") return finish(await pages(input));
  if (input.petalId === "tool:organize") return finish([await organize(input)]);
  return null;
}

async function each(
  input: Job,
  suffix: string,
  command: (file: WheelFile, output: string) => { args: string[] },
  extension?: string,
) {
  const outputs: string[] = [];
  const exe = await input.engines.ensure("ffmpeg");
  for (const file of input.files) {
    const output = allocateFile(
      path.dirname(file.path),
      toolBase(file.name, suffix),
      extension || file.ext || "mp4",
      fs.existsSync,
    );
    input.notify(`${suffix} ${file.name}`);
    await runChecked(exe, command(file, output).args, file.name, input.notify);
    outputs.push(output);
  }
  return outputs;
}

async function trim(input: Job) {
  if (input.options?.silence)
    return each(input, "Trimmed", (file, output) =>
      silenceTrimCommand(file.path, output),
    );
  const start = Number(input.options?.start) || 0;
  const end = Number(input.options?.end);
  return each(input, "Trimmed", (file, output) =>
    trimCommand(
      file.path,
      output,
      start,
      Number.isFinite(end) ? end : start + 5,
    ),
  );
}

async function crop(input: Job) {
  const box = {
    x: Number(input.options?.x) || 0,
    y: Number(input.options?.y) || 0,
    w: Number(input.options?.w) || 0,
    h: Number(input.options?.h) || 0,
  };
  return each(input, "Cropped", (file, output) =>
    videoCropCommand(file.path, output, box),
  );
}

async function speed(input: Job) {
  const rate = Number(input.options?.rate) || 1;
  const suffix = `Speed ${String(rate)}x`;
  return each(input, suffix, (file, output) =>
    speedCommand(file.path, output, rate),
  );
}

async function join(input: Job) {
  const order = Array.isArray(input.options?.order)
    ? input.options.order.flatMap((item) => {
        const file = input.files.find((entry) => entry.path === item);
        return file ? [file] : [];
      })
    : input.files;
  const files = order.length ? order : input.files;
  const output = allocateFile(
    path.dirname(files[0].path),
    toolBase(files[0].name, "Joined"),
    files[0].ext || "mp4",
    fs.existsSync,
  );
  const list = path.join(os.tmpdir(), `yami-join-${Date.now()}.txt`);
  await fs.promises.writeFile(
    list,
    concatList(files.map((file) => file.path)),
    "utf8",
  );
  try {
    const exe = await input.engines.ensure("ffmpeg");
    await runChecked(exe, joinCommand(list, output).args, "Join", input.notify);
  } finally {
    await fs.promises.rm(list, { force: true });
  }
  return output;
}

async function burst(
  input: Job,
  suffix: "Snapshots" | "Clips",
  command: (
    inputPath: string,
    pattern: string,
    every: number,
  ) => { args: string[] },
) {
  const file = input.files[0];
  const every = Number(input.options?.every) || (suffix === "Clips" ? 10 : 1);
  const folder = allocateFolder(
    path.dirname(file.path),
    `${stemOf(file.name)} ${suffix}`,
    fs.existsSync,
  );
  await fs.promises.mkdir(folder, { recursive: true });
  const pattern = path.join(
    folder,
    suffix === "Clips" ? `clip-%03d.${file.ext || "mp4"}` : "shot-%03d.png",
  );
  const exe = await input.engines.ensure("ffmpeg");
  await runChecked(
    exe,
    command(file.path, pattern, every).args,
    file.name,
    input.notify,
  );
  const made = (await fs.promises.readdir(folder)).map((name) =>
    path.join(folder, name),
  );
  if (!made.length) throw new Error("ffmpeg did not write any files.");
  return made;
}

async function redact(input: Job) {
  const boxes = Array.isArray(input.options?.boxes)
    ? (input.options.boxes as RedactBox[])
    : [];
  return each(input, "Redacted", (file, output) =>
    videoRedactCommand(file.path, output, boxes),
  );
}

async function normalize(input: Job) {
  const target: Loudness = {
    i: Number(input.options?.i ?? -16),
    lra: Number(input.options?.lra ?? 11),
    tp: Number(input.options?.tp ?? -1.5),
  };
  const outputs: string[] = [];
  const exe = await input.engines.ensure("ffmpeg");
  for (const file of input.files) {
    const output = allocateFile(
      path.dirname(file.path),
      toolBase(file.name, "Normalized"),
      file.ext || "wav",
      fs.existsSync,
    );
    const measured = parseLoudnorm(
      (await runProcess(exe, normalizeMeasureCommand(file.path).args)).stderr,
    );
    const command = measured
      ? normalizeApplyCommand(file.path, output, target, measured)
      : normalizeCommand(file.path, output, target);
    await runChecked(exe, command.args, file.name, input.notify);
    outputs.push(output);
  }
  return outputs;
}

async function channels(input: Job) {
  const layout = input.options?.layout === "stereo" ? "stereo" : "mono";
  const left = Number(input.options?.left ?? 1);
  const right = Number(input.options?.right ?? 1);
  return each(input, layout === "mono" ? "Mono" : "Channels", (file, output) =>
    channelsCommand(file.path, output, layout, left, right),
  );
}

async function bleep(input: Job) {
  const start = Number(input.options?.start) || 0;
  const end = Number(input.options?.end ?? start + 1);
  const hz = Number(input.options?.hz) || 1000;
  return each(input, "Bleeped", (file, output) =>
    bleepCommand(file.path, output, start, end, hz),
  );
}

async function visualizer(input: Job) {
  return each(
    input,
    "Visualizer",
    (file, output) => visualizerCommand(file.path, output),
    "mp4",
  );
}

async function pages(input: Job) {
  const file = input.files[0];
  const folder = allocateFolder(
    path.dirname(file.path),
    `${stemOf(file.name)} Pages`,
    fs.existsSync,
  );
  await fs.promises.mkdir(folder, { recursive: true });
  return splitPdf(file.path, folder, stemOf(file.name));
}

async function organize(input: Job) {
  const file = input.files[0];
  const pages = Array.isArray(input.options?.pages)
    ? (input.options.pages as PageEdit[])
    : [];
  const output = allocateFile(
    path.dirname(file.path),
    toolBase(file.name, "Organized"),
    "pdf",
    fs.existsSync,
  );
  await organizePdf(file.path, output, pages);
  return output;
}
