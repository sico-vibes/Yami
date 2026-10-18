import type { EngineCommand } from "./plans.ts";

export type RedactBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  start: number;
  end: number;
  mode: "blur" | "solid";
};

export type Loudness = { i: number; lra: number; tp: number };
export type MeasuredLoudness = Loudness & { thresh: number; offset: number };

function ffmpeg(input: string, extra: string[], output: string): EngineCommand {
  return {
    engine: "ffmpeg",
    args: ["-hide_banner", "-y", "-i", input, ...extra, "-progress", "pipe:1", "-nostats", output],
  };
}

function range(value: number, label: string, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label} is out of range.`);
  return Math.round(value * 1000) / 1000;
}

function text(value: number, label: string, min: number, max: number) {
  return String(range(value, label, min, max));
}

function whole(value: number, label: string, min: number, max: number) {
  return String(Math.round(range(value, label, min, max)));
}

export function muteCommand(input: string, output: string): EngineCommand {
  return ffmpeg(input, ["-an", "-c:v", "copy"], output);
}

export function trimCommand(input: string, output: string, start: number, end: number): EngineCommand {
  const from = text(start, "Start", 0, 86_400);
  const to = text(end, "End", 0, 86_400);
  if (Number(to) <= Number(from)) throw new Error("The end must be after the start.");
  return ffmpeg(input, ["-ss", from, "-to", to], output);
}

export function silenceTrimCommand(input: string, output: string): EngineCommand {
  return ffmpeg(
    input,
    [
      "-af",
      "silenceremove=start_periods=1:start_silence=0.3:start_threshold=-50dB:stop_periods=-1:stop_silence=0.4:stop_threshold=-50dB",
    ],
    output,
  );
}

export function videoCropCommand(
  input: string,
  output: string,
  box: { x: number; y: number; w: number; h: number },
): EngineCommand {
  const x = whole(box.x, "X", 0, 16_000);
  const y = whole(box.y, "Y", 0, 16_000);
  const w = whole(box.w, "Width", 2, 16_000);
  const h = whole(box.h, "Height", 2, 16_000);
  return ffmpeg(input, ["-vf", `crop=${w}:${h}:${x}:${y}`, "-c:a", "copy"], output);
}

export function speedCommand(input: string, output: string, rate: number): EngineCommand {
  const speed = range(rate, "Speed", 0.5, 2);
  const video = (1 / speed).toFixed(4);
  return ffmpeg(
    input,
    [
      "-filter_complex",
      `[0:v]setpts=${video}*PTS[v];[0:a]atempo=${speed.toFixed(4)}[a]`,
      "-map",
      "[v]",
      "-map",
      "[a]",
    ],
    output,
  );
}

export function concatList(paths: string[]) {
  if (paths.some((file) => /[\r\n]/.test(file)))
    throw new Error("That file path cannot be joined.");
  if (paths.length < 2) throw new Error("Join needs at least two files.");
  return paths
    .map((file) => `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
    .join("\n");
}

export function joinCommand(listFile: string, output: string): EngineCommand {
  return {
    engine: "ffmpeg",
    args: [
      "-hide_banner",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      "-progress",
      "pipe:1",
      "-nostats",
      output,
    ],
  };
}

export function snapshotCommand(input: string, pattern: string, everySeconds: number): EngineCommand {
  const step = text(everySeconds, "Interval", 0.2, 3600);
  return ffmpeg(input, ["-vf", `fps=1/${step}`], pattern);
}

export function splitCommand(input: string, pattern: string, seconds: number): EngineCommand {
  const step = text(seconds, "Clip length", 1, 3600);
  return {
    engine: "ffmpeg",
    args: [
      "-hide_banner",
      "-y",
      "-i",
      input,
      "-c",
      "copy",
      "-f",
      "segment",
      "-segment_time",
      step,
      "-reset_timestamps",
      "1",
      pattern,
    ],
  };
}

export function videoRedactCommand(input: string, output: string, boxes: RedactBox[]): EngineCommand {
  if (!boxes.length) throw new Error("Draw a box to hide.");
  if (boxes.length > 6) throw new Error("Six boxes is the limit for one pass.");
  const parts: string[] = [];
  let current = "[0:v]";
  boxes.forEach((box, index) => {
    const x = whole(box.x, "X", 0, 16_000);
    const y = whole(box.y, "Y", 0, 16_000);
    const w = whole(box.w, "Width", 2, 16_000);
    const h = whole(box.h, "Height", 2, 16_000);
    const start = text(box.start, "Start", 0, 86_400);
    const end = text(box.end, "End", 0, 86_400);
    if (Number(end) <= Number(start)) throw new Error("The end must be after the start.");
    const next = index === boxes.length - 1 ? "[v]" : `[v${index}]`;
    if (box.mode === "solid") {
      parts.push(
        `${current}drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=black:t=fill:enable='between(t,${start},${end})'${next}`,
      );
    } else {
      parts.push(`${current}split=2[base${index}][crop${index}]`);
      parts.push(`[crop${index}]crop=${w}:${h}:${x}:${y},boxblur=8:1[blur${index}]`);
      parts.push(
        `[base${index}][blur${index}]overlay=${x}:${y}:enable='between(t,${start},${end})'${next}`,
      );
    }
    current = next;
  });
  return ffmpeg(input, ["-filter_complex", parts.join(";"), "-map", "[v]", "-map", "0:a?"], output);
}

export function normalizeCommand(input: string, output: string, loudness: Loudness): EngineCommand {
  const target = loudnessText(loudness);
  return ffmpeg(input, ["-af", `loudnorm=${target}`], output);
}

export function normalizeMeasureCommand(input: string): EngineCommand {
  return {
    engine: "ffmpeg",
    args: [
      "-hide_banner",
      "-i",
      input,
      "-af",
      "loudnorm=I=-16:LRA=11:TP=-1.5:print_format=json",
      "-f",
      "null",
      "-",
    ],
  };
}

export function normalizeApplyCommand(
  input: string,
  output: string,
  target: Loudness,
  measured: MeasuredLoudness,
): EngineCommand {
  const filter = [
    loudnessText(target),
    `measured_I=${text(measured.i, "Measured loudness", -99, 0)}`,
    `measured_LRA=${text(measured.lra, "Measured range", 0, 99)}`,
    `measured_TP=${text(measured.tp, "Measured peak", -99, 10)}`,
    `measured_thresh=${text(measured.thresh, "Measured threshold", -99, 0)}`,
    `offset=${text(measured.offset, "Offset", -99, 99)}`,
    "linear=true",
  ].join(":");
  return ffmpeg(input, ["-af", `loudnorm=${filter}`], output);
}

function loudnessText(loudness: Loudness) {
  return [
    `I=${text(loudness.i, "Loudness", -36, -8)}`,
    `LRA=${text(loudness.lra, "Range", 1, 20)}`,
    `TP=${text(loudness.tp, "True peak", -9, -0.1)}`,
  ].join(":");
}

export function parseLoudnorm(stderr: string): MeasuredLoudness | null {
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const json = JSON.parse(stderr.slice(start, end + 1)) as Record<string, string>;
    const measured = {
      i: Number(json.input_i),
      lra: Number(json.input_lra),
      tp: Number(json.input_tp),
      thresh: Number(json.input_thresh),
      offset: Number(json.target_offset),
    };
    if (Object.values(measured).some((value) => !Number.isFinite(value))) return null;
    return measured;
  } catch {
    return null;
  }
}

export function channelsCommand(
  input: string,
  output: string,
  layout: "mono" | "stereo",
  left: number,
  right: number,
): EngineCommand {
  const l = text(left, "Left", 0, 2);
  const r = text(right, "Right", 0, 2);
  if (layout === "mono")
    return ffmpeg(input, ["-ac", "1", "-af", `volume=${text((left + right) / 2, "Volume", 0, 2)}`], output);
  return ffmpeg(input, ["-af", `pan=stereo|c0=${l}*c0|c1=${r}*c1`], output);
}

export function bleepCommand(
  input: string,
  output: string,
  start: number,
  end: number,
  hz: number,
): EngineCommand {
  const from = text(start, "Start", 0, 86_400);
  const to = text(end, "End", 0, 86_400);
  if (Number(to) <= Number(from)) throw new Error("The end must be after the start.");
  const tone = text(hz, "Tone", 200, 4000);
  const filter = [
    `[0:a]volume=0:enable='between(t,${from},${to})'[voice]`,
    `sine=frequency=${tone}:sample_rate=48000:duration=${to},volume=0:enable='lt(t,${from})'[tone]`,
    `[voice][tone]amix=inputs=2:duration=first:dropout_transition=0`,
  ].join(";");
  return ffmpeg(input, ["-filter_complex", filter], output);
}

export function visualizerCommand(input: string, output: string): EngineCommand {
  return ffmpeg(
    input,
    [
      "-filter_complex",
      "[0:a]showwaves=s=1280x720:mode=cline:colors=0xBBA057[v]",
      "-map",
      "[v]",
      "-map",
      "0:a",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-shortest",
    ],
    output,
  );
}
