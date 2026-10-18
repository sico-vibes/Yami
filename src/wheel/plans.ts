export type EngineCommand = {
  engine: "ffmpeg" | "magick" | "exiftool" | "sevenZip";
  args: string[];
};

const AUDIO: Record<string, string[]> = {
  mp3: ["-c:a", "libmp3lame", "-q:a", "2"],
  m4a: ["-c:a", "aac", "-b:a", "192k"],
  wav: ["-c:a", "pcm_s16le"],
  flac: ["-c:a", "flac"],
  ogg: ["-c:a", "libvorbis", "-q:a", "5"],
  opus: ["-c:a", "libopus", "-b:a", "128k"],
  aiff: ["-c:a", "pcm_s16be"],
  wma: ["-c:a", "wmav2", "-b:a", "192k"],
};

const VIDEO: Record<string, string[]> = {
  mp4: ["-c:v", "libx264", "-crf", "20", "-c:a", "aac", "-b:a", "160k"],
  mov: ["-c:v", "libx264", "-crf", "20", "-c:a", "aac", "-b:a", "160k"],
  mkv: ["-c:v", "libx264", "-crf", "20", "-c:a", "aac", "-b:a", "160k"],
  webm: ["-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-c:a", "libopus"],
  avi: ["-c:v", "mpeg4", "-q:v", "4", "-c:a", "mp3"],
  wmv: ["-c:v", "wmv2", "-b:v", "2M", "-c:a", "wmav2"],
};

function ffmpeg(input: string, extra: string[], output: string): EngineCommand {
  return {
    engine: "ffmpeg",
    args: ["-hide_banner", "-y", "-i", input, ...extra, "-progress", "pipe:1", "-nostats", output],
  };
}

export function convertCommand(
  kind: string,
  target: string,
  input: string,
  output: string,
): EngineCommand {
  if (target === "heic")
    throw new Error(
      "HEIC encoding is not available. The portable ImageMagick build has no x265 encoder, and this build does not claim ffmpeg can write HEIC.",
    );
  if (kind === "audio" || target === "mp3")
    return ffmpeg(input, target === "mp3" && kind !== "audio" ? ["-vn", ...AUDIO.mp3] : AUDIO[target] || [], output);
  if (kind === "video" || kind === "gif") {
    if (target === "gif")
      return ffmpeg(input, ["-vf", "fps=12,scale=480:-1:flags=lanczos"], output);
    return ffmpeg(input, VIDEO[target] || [], output);
  }
  const quality = target === "jpg" ? ["-quality", "92"] : [];
  return { engine: "magick", args: [input, "-auto-orient", ...quality, output] };
}

const COMPRESS_QUALITY = { smaller: "70", balanced: "82", smallest: "45" } as const;
export type CompressPreset = keyof typeof COMPRESS_QUALITY;

export function compressImageCommand(
  input: string,
  output: string,
  preset: CompressPreset,
  percent: number,
): EngineCommand {
  const args = [input, "-auto-orient", "-strip", "-quality", COMPRESS_QUALITY[preset] || "82"];
  if (percent > 0 && percent < 100) args.push("-resize", `${Math.round(percent)}%`);
  args.push(output);
  return { engine: "magick", args };
}

export function compressAudioCommand(
  input: string,
  output: string,
  preset: CompressPreset,
): EngineCommand {
  const bitrate = preset === "smallest" ? "96k" : preset === "smaller" ? "128k" : "160k";
  const quality = preset === "smallest" ? "7" : preset === "smaller" ? "5" : "3";
  if (output.toLowerCase().endsWith(".mp3"))
    return ffmpeg(input, ["-c:a", "libmp3lame", "-q:a", quality], output);
  return ffmpeg(input, ["-c:a", "aac", "-b:a", bitrate], output);
}

export function compressVideoTargetCommand(
  input: string,
  output: string,
  bitrate: number,
): EngineCommand {
  return ffmpeg(
    input,
    ["-c:v", "libx264", "-b:v", String(bitrate), "-c:a", "aac", "-b:a", "128k"],
    output,
  );
}

export function compressVideoCommand(
  input: string,
  output: string,
  preset: CompressPreset,
): EngineCommand {
  const crf = preset === "smallest" ? "32" : preset === "smaller" ? "28" : "23";
  return ffmpeg(input, ["-c:v", "libx264", "-crf", crf, "-c:a", "aac", "-b:a", "128k"], output);
}

export function videoTargetBitrate(targetBytes: number, durationSeconds: number) {
  if (targetBytes < 50_000 || durationSeconds < 0.2) return 80_000;
  const bits = targetBytes * 8 * 0.9;
  return Math.max(80_000, Math.round(bits / durationSeconds) - 128_000);
}

export function stripMetadataCommand(
  kind: string,
  input: string,
  output: string,
): EngineCommand {
  if (kind === "audio" || kind === "video" || kind === "gif")
    return ffmpeg(input, ["-map_metadata", "-1", "-c", "copy"], output);
  return { engine: "exiftool", args: ["-all=", "-o", output, input] };
}

export function editMetadataCommand(
  input: string,
  output: string,
  edits: { tag: string; value: string }[],
): EngineCommand {
  const args = edits.map((edit) => {
    if (!/^[A-Za-z0-9:]+$/.test(edit.tag))
      throw new Error("That metadata field name is not allowed.");
    return `-${edit.tag}=${edit.value.replace(/[\r\n]/g, " ")}`;
  });
  return { engine: "exiftool", args: [...args, "-o", output, input] };
}

export function extractKind(ext: string) {
  if (ext === "zip") return "zip";
  if (ext === "tar") return "tar";
  if (ext === "gz" || ext === "tgz" || ext === "tar.gz") return "gzip";
  if (ext === "rar" || ext === "7z") return "seven";
  throw new Error("That archive can be extracted with 7-Zip only after it is installed, and this type is not supported.");
}
