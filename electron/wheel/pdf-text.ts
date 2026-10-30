import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

function pdfjsRequire() {
  try {
    if (import.meta.url) return createRequire(import.meta.url);
  } catch {}
  return createRequire(pathToFileURL(__filename).href);
}

const require = pdfjsRequire();

export async function pdfToText(bytes: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fonts =
    path.join(
      path.dirname(require.resolve("pdfjs-dist/package.json")),
      "standard_fonts",
    ) + "/";
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    standardFontDataUrl: fonts,
    isEvalSupported: false,
    useSystemFonts: true,
  } as Parameters<typeof pdfjs.getDocument>[0]);
  const doc = await task.promise;
  const pages: string[] = [];
  const limit = Math.min(doc.numPages, 200);
  for (let index = 1; index <= limit; index += 1) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    pages.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
  }
  if (doc.numPages > limit) pages.push("Stopped after 200 pages.");
  return pages.join("\n\n").trim();
}
