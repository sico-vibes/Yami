import type { Petal, WheelCaps, WheelMode } from "./types";

const COMPOUND = [".tar.gz", ".tar.bz2", ".tar.xz"];

export function extensionOf(name: string) {
  const lower = name.toLowerCase();
  const compound = COMPOUND.find((ext) => lower.endsWith(ext));
  if (compound) return compound.slice(1);
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot + 1) : "";
}

export type FileKind =
  | "image"
  | "gif"
  | "audio"
  | "video"
  | "document"
  | "sheet"
  | "pdf"
  | "archive"
  | "subtitle"
  | "slides"
  | "unknown";

const IMAGE = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "tif",
  "tiff",
  "avif",
  "bmp",
  "svg",
]);
const AUDIO = new Set([
  "mp3",
  "m4a",
  "wav",
  "flac",
  "ogg",
  "opus",
  "aiff",
  "aif",
  "wma",
]);
const VIDEO = new Set(["mp4", "mov", "mkv", "webm", "avi", "wmv"]);
const DOC = new Set([
  "docx",
  "md",
  "markdown",
  "rtf",
  "txt",
  "html",
  "htm",
  "epub",
]);
const SHEET = new Set(["xlsx", "xls", "ods", "csv", "tsv"]);
const ARCHIVE = new Set([
  "zip",
  "tar",
  "gz",
  "tgz",
  "rar",
  "7z",
  "tar.gz",
  "tar.bz2",
  "tar.xz",
]);
const SUB = new Set(["srt", "vtt"]);
const SLIDES = new Set(["ppt", "pptx"]);

export function kindOf(name: string): FileKind {
  const ext = extensionOf(name);
  if (ext === "gif") return "gif";
  if (IMAGE.has(ext)) return "image";
  if (AUDIO.has(ext)) return "audio";
  if (VIDEO.has(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (SHEET.has(ext)) return "sheet";
  if (SUB.has(ext)) return "subtitle";
  if (SLIDES.has(ext)) return "slides";
  if (ARCHIVE.has(ext)) return "archive";
  if (DOC.has(ext)) return "document";
  return "unknown";
}

const LABEL: Record<string, string> = {
  jpg: "JPG",
  png: "PNG",
  webp: "WebP",
  heic: "HEIC",
  tiff: "TIFF",
  avif: "AVIF",
  bmp: "BMP",
  gif: "GIF",
  pdf: "PDF",
  mp3: "MP3",
  m4a: "M4A",
  wav: "WAV",
  flac: "FLAC",
  ogg: "OGG",
  opus: "Opus",
  aiff: "AIFF",
  wma: "WMA",
  mp4: "MP4",
  mov: "MOV",
  mkv: "MKV",
  webm: "WebM",
  avi: "AVI",
  wmv: "WMV",
  docx: "DOCX",
  md: "Markdown",
  txt: "Text",
  html: "HTML",
  epub: "EPUB",
  xlsx: "XLSX",
  xls: "XLS",
  ods: "ODS",
  csv: "CSV",
  tsv: "TSV",
  zip: "ZIP",
  tar: "TAR",
  gz: "GZ",
  srt: "SRT",
  vtt: "VTT",
};

function convertTargets(kind: FileKind, caps: WheelCaps): string[] {
  switch (kind) {
    case "image":
      return ["jpg", "png", "webp", "tiff", "avif", "bmp", "gif", "pdf"].concat(
        caps.heicEncode ? ["heic"] : [],
      );
    case "gif":
      return ["mp4", "mov", "mkv", "webm", "avi", "wmv"];
    case "audio":
      return ["mp3", "m4a", "wav", "flac", "ogg", "opus", "aiff", "wma"];
    case "video":
      return ["mp4", "mov", "mkv", "webm", "avi", "wmv", "gif", "mp3"];
    case "document":
      return ["docx", "pdf", "txt", "md", "html", "epub", "png", "jpg"];
    case "sheet":
      return ["xlsx", "xls", "ods", "csv", "tsv", "pdf"];
    case "pdf":
      return ["txt", "md", "png", "jpg", "epub"];
    case "archive":
      return ["zip", "tar", "gz"];
    case "subtitle":
      return ["srt", "vtt", "txt"];
    case "slides":
      return ["pdf", "png", "jpg"];
    default:
      return [];
  }
}

function toolPetals(kind: FileKind, count: number): Petal[] {
  const one = (id: string, label: string, window = true): Petal => ({
    id,
    label,
    group: "tools",
    window,
  });
  const common = [
    one("tool:compress", "Compress"),
    one("tool:metadata", "Details"),
    ...(count > 1 ? [one("tool:rename", "Rename")] : []),
  ];
  if (count > 1 && (kind === "image" || kind === "gif"))
    return [
      ...common,
      one("tool:crop", "Crop"),
      one("tool:pdf", "Pages PDF"),
      one("tool:collage", "Collage"),
    ];
  if (kind === "image" || kind === "gif")
    return [
      ...common,
      one("tool:adjust", "Adjust"),
      one("tool:markup", "Markup"),
      one("tool:background", "Background"),
      one("tool:crop", "Crop"),
      one("tool:redact", "Redact"),
      one("tool:qr", "QR code"),
      one("tool:ocr", "Copy text", false),
    ];
  if (kind === "video" && count > 1)
    return [
      ...common,
      one("tool:join", "Join"),
      one("tool:trim", "Trim"),
      one("tool:video-crop", "Crop"),
      one("tool:speed", "Speed"),
    ];
  if (kind === "video")
    return [
      ...common,
      one("tool:mute", "Mute", false),
      one("tool:trim", "Trim"),
      one("tool:video-crop", "Crop"),
      one("tool:speed", "Speed"),
      one("tool:snapshots", "Snapshots"),
      one("tool:split", "Split"),
      one("tool:video-redact", "Redact"),
    ];
  if (kind === "audio")
    return [
      ...common,
      one("tool:normalize", "Normalize"),
      one("tool:visualizer", "Visualizer", count === 1),
      one("tool:trim", "Trim"),
      one("tool:channels", "Channels"),
      one("tool:bleep", "Bleep"),
    ];
  if (kind === "pdf")
    return [
      ...common,
      one("tool:pdf-split", "Split pages"),
      ...(count === 1 ? [one("tool:organize", "Organize")] : []),
      ...(count > 1 ? [one("tool:merge", "Merge")] : []),
    ];
  if (kind === "archive") return [one("tool:extract", "Extract", false)];
  return common;
}

const ACTIONS: Petal[] = [
  { id: "action:copy", label: "Copy", group: "actions", window: false },
  { id: "action:move", label: "Move", group: "actions", window: false },
  { id: "action:path", label: "Copy path", group: "actions", window: false },
  { id: "action:terminal", label: "Terminal", group: "actions", window: false },
  { id: "action:float", label: "Float", group: "actions", window: false },
];

/** For a selection with a folder; folder names end in "/" in petalsFor. */
const FOLDER_ACTIONS: Petal[] = [
  { id: "action:copy", label: "Copy", group: "actions", window: false },
  { id: "action:move", label: "Move", group: "actions", window: false },
  { id: "action:path", label: "Copy path", group: "actions", window: false },
  {
    id: "action:terminal",
    label: "Terminal here",
    group: "actions",
    window: false,
  },
  { id: "action:size", label: "Folder size", group: "actions", window: false },
  { id: "action:zip", label: "Zip", group: "actions", window: false },
  {
    id: "action:duplicates",
    label: "Find duplicates",
    group: "actions",
    window: false,
  },
  {
    id: "action:project",
    label: "Add as project",
    group: "actions",
    window: false,
  },
  { id: "action:icon", label: "Change icon", group: "actions", window: false },
  {
    id: "action:icon-reset",
    label: "Reset icon",
    group: "actions",
    window: false,
  },
];

/** Petals that act on exactly one folder. */
const ONE_FOLDER = ["action:project", "action:icon", "action:icon-reset"];

export const isFolderName = (name: string) => name.endsWith("/");
/** The names petalsFor reads: folders carry a trailing "/". */
export const wheelNames = (files: { name: string; folder?: boolean }[]) =>
  files.map((f) => (f.folder ? f.name + "/" : f.name));

function canonicalExt(ext: string) {
  if (ext === "jpeg") return "jpg";
  if (ext === "tif") return "tiff";
  if (ext === "aif") return "aiff";
  if (ext === "htm" || ext === "markdown")
    return ext === "markdown" ? "md" : "html";
  if (ext === "tgz") return "gz";
  return ext;
}

export function petalsFor(
  names: string[],
  mode: WheelMode,
  caps: WheelCaps = {},
): Petal[] {
  if (!names.length) return mode === "actions" ? ACTIONS : [];
  if (names.some(isFolderName))
    return mode === "actions"
      ? FOLDER_ACTIONS.filter(
          (p) =>
            !ONE_FOLDER.includes(p.id) ||
            (names.length === 1 && isFolderName(names[0])),
        )
      : [];
  const kinds = names.map(kindOf);
  const same = kinds.every((kind) => kind === kinds[0]);
  if (mode === "actions") return ACTIONS;
  if (mode === "tools") {
    if (!same) return toolPetals("unknown", names.length);
    return toolPetals(kinds[0], names.length);
  }
  if (!same || kinds[0] === "unknown") return [];
  const targets = convertTargets(kinds[0], caps);
  const exts = names.map((name) => canonicalExt(extensionOf(name)));
  return targets
    .filter((target) => exts.some((ext) => ext !== target))
    .map((target) => ({
      id: `to:${target}`,
      label: LABEL[target] || target.toUpperCase(),
      group: "convert" as const,
      window: false,
    }));
}

export function emptyHint(mode: WheelMode, names: string[]) {
  if (!names.length)
    return mode === "actions"
      ? "Choose a file action."
      : "Drop a file, or select files in Explorer.";
  if (names.some(isFolderName) && mode !== "actions")
    return "Folders take actions. Tap the actions key, or flip the wheel.";
  if (mode === "convert" && new Set(names.map(kindOf)).size > 1)
    return "These files are different kinds, so there is no shared conversion.";
  return "Nothing on this wheel fits the selection.";
}

export const PREVIEW_SAMPLES: { id: string; label: string; names: string[] }[] =
  [
    { id: "image", label: "Image", names: ["grove.png"] },
    { id: "images", label: "Images", names: ["grove.png", "orchard.jpg"] },
    { id: "audio", label: "Audio", names: ["evening.wav"] },
    { id: "video", label: "Video", names: ["walk.mp4"] },
    { id: "videos", label: "Videos", names: ["walk.mp4", "gate.mov"] },
    { id: "gif", label: "GIF", names: ["loop.gif"] },
    { id: "pdf", label: "PDF", names: ["notes.pdf"] },
    { id: "pdfs", label: "PDFs", names: ["notes.pdf", "extra.pdf"] },
    { id: "archive", label: "Archive", names: ["bundle.zip"] },
    { id: "document", label: "Document", names: ["letter.docx"] },
    { id: "sheet", label: "Sheet", names: ["budget.xlsx"] },
    { id: "subtitle", label: "Subtitles", names: ["dialog.srt"] },
    { id: "slides", label: "Slides", names: ["talk.pptx"] },
    { id: "mixed", label: "Mixed", names: ["grove.png", "notes.pdf"] },
  ];
