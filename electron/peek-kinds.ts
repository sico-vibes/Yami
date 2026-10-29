import path from "node:path";

// What quick look can show, and the page for text files. Kept apart from the
// window code so tests can load it.

const kinds: Record<string, "image" | "pdf" | "media" | "text"> = {};
for (const e of "png jpg jpeg gif webp bmp ico avif svg".split(" "))
  kinds[e] = "image";
for (const e of "mp4 webm mov m4v mp3 wav ogg oga m4a flac aac opus".split(" "))
  kinds[e] = "media";
for (const e of (
  "txt md log json jsonc csv tsv ts tsx js jsx mjs cjs py cs ps1 psm1 bat cmd sh css scss html htm xml yml yaml ini toml cfg conf " +
  "c h cpp hpp rs go java kt rb php sql lua r gitignore env"
).split(" "))
  kinds[e] = "text";
kinds.pdf = "pdf";

export function peekKind(file: string) {
  const ext =
    path.extname(file).slice(1).toLowerCase() ||
    path.basename(file).replace(/^\./, "").toLowerCase();
  return kinds[ext];
}

export const TEXT_LIMIT = 512 * 1024;
/** HTML for showing a text file as plain text, escaped. */
export function textPage(name: string, text: string, cut: boolean) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><meta charset="utf-8"><title>${esc(name)}</title><style>
body{margin:0;background:#0b0a1e;color:#e9e6ff;font:13px/1.5 "Cascadia Mono",Consolas,monospace}
pre{margin:0;padding:16px 20px;white-space:pre-wrap;overflow-wrap:anywhere}
p{margin:0;padding:8px 20px;color:#a9a3cf;font-family:system-ui}</style>
${cut ? `<p>Showing the first ${TEXT_LIMIT / 1024} KB.</p>` : ""}<pre>${esc(text)}</pre>`;
}
