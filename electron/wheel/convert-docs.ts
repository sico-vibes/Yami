import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extensionOf, kindOf } from "../../src/wheel/catalog.ts";
import {
  docxEntries,
  docxText,
  epubEntries,
  epubHtml,
  htmlDocument,
  parseTable,
  tableToCsv,
  textToPdfLines,
  xlsxEntries,
  xlsxRows,
} from "../../src/wheel/office-xml.ts";
import {
  htmlToText,
  markdownToHtml,
  markdownToText,
  textToHtml,
} from "../../src/wheel/prose.ts";
import { sofficeArgs, sofficeCandidates } from "../../src/wheel/soffice.ts";
import { convertSubtitle } from "../../src/wheel/subtitles.ts";
import {
  packGzip,
  packTar,
  packZip,
  unpackGzip,
  unpackTar,
  unpackZip,
} from "./archive.ts";
import { pdfToText } from "./pdf-text.ts";
import { runChecked, runProcess } from "./spawn.ts";

const OFFICE = new Set([
  "document",
  "sheet",
  "pdf",
  "archive",
  "subtitle",
  "slides",
]);

export function isOfficeKind(name: string) {
  return OFFICE.has(kindOf(name));
}

export async function convertOffice(
  input: string,
  name: string,
  output: string,
  target: string,
  notify: (message: string) => void,
) {
  const kind = kindOf(name);
  const ext = extensionOf(name);
  notify(`Converting ${name}`);
  if (kind === "subtitle") {
    await fs.promises.writeFile(
      output,
      convertSubtitle(await fs.promises.readFile(input, "utf8"), target),
    );
    return;
  }
  if (kind === "archive") {
    await fs.promises.writeFile(
      output,
      await repack(await fs.promises.readFile(input), ext, target, name),
    );
    return;
  }
  if (kind === "slides" || target === "png" || target === "jpg") {
    await withSoffice(input, output, target);
    return;
  }
  if (kind === "sheet") {
    await writeSheet(await readSheet(input, ext), target, output, name);
    return;
  }
  if (ext === "epub" && target === "html") {
    await fs.promises.writeFile(
      output,
      htmlDocument(
        name,
        epubHtml(unpackZip(await fs.promises.readFile(input))),
      ),
    );
    return;
  }
  if (kind === "pdf") {
    const text = await pdfToText(await fs.promises.readFile(input));
    if (!text) throw new Error("No text was found in that PDF.");
    if (target === "txt" || target === "md")
      await fs.promises.writeFile(output, text);
    else if (target === "epub")
      await fs.promises.writeFile(
        output,
        packZip(epubEntries(name, textToHtml(text))),
      );
    else throw new Error("That PDF conversion is not connected.");
    return;
  }
  const plain = await readDocument(input, ext);
  await writeDocument(plain, ext, target, output, name);
}

async function readDocument(input: string, ext: string) {
  if (ext === "docx")
    return docxText(unpackZip(await fs.promises.readFile(input)));
  if (ext === "epub")
    return htmlToText(epubHtml(unpackZip(await fs.promises.readFile(input))));
  const text = await fs.promises.readFile(input, "utf8");
  if (ext === "html" || ext === "htm") return htmlToText(text);
  if (ext === "rtf") return rtfToText(text);
  return text;
}

async function writeDocument(
  plain: string,
  source: string,
  target: string,
  output: string,
  name: string,
) {
  if (target === "txt" || target === "md") {
    const text =
      source === "md" && target === "txt" ? markdownToText(plain) : plain;
    await fs.promises.writeFile(output, text);
    return;
  }
  if (target === "html") {
    const body = source === "md" ? markdownToHtml(plain) : textToHtml(plain);
    await fs.promises.writeFile(output, htmlDocument(name, body));
    return;
  }
  if (target === "docx") {
    const text =
      source === "md"
        ? markdownToText(plain)
        : source === "html"
          ? htmlToText(plain)
          : plain;
    await fs.promises.writeFile(output, packZip(docxEntries(text)));
    return;
  }
  if (target === "epub") {
    const html =
      source === "md"
        ? markdownToHtml(plain)
        : source === "html"
          ? plain
          : textToHtml(plain);
    await fs.promises.writeFile(output, packZip(epubEntries(name, html)));
    return;
  }
  if (target === "pdf") {
    const text = source === "md" ? markdownToText(plain) : plain;
    await writeTextPdf(text, output);
    return;
  }
  throw new Error("That document conversion is not connected.");
}

async function readSheet(input: string, ext: string) {
  if (ext === "csv" || ext === "tsv")
    return parseTable(
      await fs.promises.readFile(input, "utf8"),
      ext === "tsv" ? "\t" : ",",
    );
  if (ext === "xlsx")
    return xlsxRows(unpackZip(await fs.promises.readFile(input)));
  if (ext === "xls" || ext === "ods")
    throw new Error(
      "XLS and ODS are not read here. Save the sheet as XLSX or CSV, or install LibreOffice and convert to PDF.",
    );
  throw new Error("That spreadsheet is not supported.");
}

async function writeSheet(
  rows: string[][],
  target: string,
  output: string,
  name: string,
) {
  if (target === "csv" || target === "tsv") {
    await fs.promises.writeFile(
      output,
      tableToCsv(rows, target === "tsv" ? "\t" : ","),
    );
    return;
  }
  if (target === "xlsx") {
    await fs.promises.writeFile(output, packZip(xlsxEntries(rows)));
    return;
  }
  if (target === "pdf") {
    await writeTextPdf(rows.map((row) => row.join("\t")).join("\n"), output);
    return;
  }
  if (target === "xls" || target === "ods")
    throw new Error(
      "This build writes CSV, TSV, XLSX, and a plain PDF. XLS and ODS are not written.",
    );
  throw new Error(`${name} cannot be saved as ${target}.`);
}

async function writeTextPdf(text: string, output: string) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([612, 792]);
  let y = 752;
  for (const line of textToPdfLines(text)) {
    if (y < 48) {
      page = doc.addPage([612, 792]);
      y = 752;
    }
    page.drawText(winAnsi(line).slice(0, 90), { x: 48, y, size: 11, font });
    y -= 16;
  }
  await fs.promises.writeFile(output, await doc.save());
}

function winAnsi(value: string) {
  return value.replace(/[^\n\r\t\x20-\x7e\u00a0-\u00ff]/g, "?");
}

function rtfToText(rtf: string) {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .trim();
}

async function repack(
  buffer: Buffer,
  ext: string,
  target: string,
  name: string,
) {
  let entries =
    ext === "zip"
      ? unpackZip(buffer)
      : ext === "tar"
        ? unpackTar(buffer)
        : unpackMaybeTar(buffer, name);
  entries = entries.filter((entry) => !entry.name.endsWith("/"));
  if (!entries.length) throw new Error("That archive has no files.");
  if (target === "zip") return packZip(entries);
  if (target === "tar") return packTar(entries);
  if (target === "gz")
    return packGzip(entries.length === 1 ? entries[0].data : packTar(entries));
  throw new Error("That archive conversion is not connected.");
}

function unpackMaybeTar(buffer: Buffer, name: string) {
  const raw = unpackGzip(buffer);
  if (raw.length > 262 && raw.subarray(257, 262).toString("utf8") === "ustar")
    return unpackTar(raw);
  const inner = name.replace(/\.tgz$/i, ".tar").replace(/\.gz$/i, "");
  return [{ name: path.basename(inner) || "file", data: raw }];
}

async function withSoffice(input: string, output: string, target: string) {
  const exe = await findSoffice();
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "yami-office-"));
  try {
    await runChecked(
      exe,
      sofficeArgs(input, dir, target),
      path.basename(input),
      () => undefined,
    );
    const made = (await fs.promises.readdir(dir)).find(
      (item) => item !== path.basename(input),
    );
    if (!made) throw new Error("LibreOffice did not write a file.");
    await fs.promises.copyFile(path.join(dir, made), output);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

async function findSoffice() {
  for (const candidate of sofficeCandidates()) {
    const result = await runProcess(candidate, ["--version"]).catch(() => null);
    if (result && result.code === 0) return candidate;
  }
  throw new Error(
    "LibreOffice is not installed. Slides and page pictures need it, and this build does not download it.",
  );
}
