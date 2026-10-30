import { escapeHtml } from "./prose.ts";

export type XmlEntry = { name: string; data: Buffer; store?: boolean };

function xml(value: string) {
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${value}`,
    "utf8",
  );
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function docxEntries(text: string): XmlEntry[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const body = (paragraphs.length ? paragraphs : [""])
    .map(
      (part) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r></w:p>`,
    )
    .join("");
  return [
    {
      name: "[Content_Types].xml",
      data: xml(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: xml(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      ),
    },
    {
      name: "word/document.xml",
      data: xml(
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
      ),
    },
  ];
}

export function docxText(entries: { name: string; data: Buffer }[]) {
  const document = entries.find(
    (entry) => entry.name.toLowerCase() === "word/document.xml",
  );
  if (!document) throw new Error("That DOCX has no document.");
  const xmlText = document.data.toString("utf8");
  const parts = [...xmlText.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(
    (match) =>
      match[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&"),
  );
  return parts.join("\n\n").trim();
}

export function tableToCsv(rows: string[][], delimiter: string) {
  return rows
    .map((row) =>
      row
        .map((cell) =>
          new RegExp(`[${delimiter}"\n]`).test(cell)
            ? `"${cell.replace(/"/g, '""')}"`
            : cell,
        )
        .join(delimiter),
    )
    .join("\n");
}

export function parseTable(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value !== ""));
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const digit = (value - 1) % 26;
    name = String.fromCharCode(65 + digit) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

export function xlsxEntries(rows: string[][]): XmlEntry[] {
  const limited = rows.slice(0, 5000).map((row) => row.slice(0, 100));
  const sheet = limited
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, cellIndex) => {
          const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
          if (/^-?\d+(\.\d+)?$/.test(cell))
            return `<c r="${ref}"><v>${cell}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return [
    {
      name: "[Content_Types].xml",
      data: xml(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: xml(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: xml(
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: xml(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: xml(
        `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`,
      ),
    },
  ];
}

export function xlsxRows(entries: { name: string; data: Buffer }[]) {
  const sheet = entries.find((entry) =>
    /xl\/worksheets\/sheet1\.xml$/i.test(entry.name),
  );
  if (!sheet) throw new Error("That spreadsheet has no first sheet.");
  const shared = entries.find((entry) =>
    /xl\/sharedStrings\.xml$/i.test(entry.name),
  );
  const strings = shared
    ? [
        ...shared.data.toString("utf8").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g),
      ].map((match) => decodeXml(match[1]))
    : [];
  const rows: string[][] = [];
  for (const row of sheet.data
    .toString("utf8")
    .matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(cell[2]);
      const value = /<v>([\s\S]*?)<\/v>/.exec(cell[2]);
      if (inline) cells.push(decodeXml(inline[1]));
      else if (value && /\bt="s"/.test(cell[1]))
        cells.push(strings[Number(value[1])] || "");
      else if (value) cells.push(decodeXml(value[1]));
      else cells.push("");
    }
    rows.push(cells);
  }
  return rows;
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

export function epubEntries(title: string, html: string): XmlEntry[] {
  const safeTitle = escapeXml(title || "Notes");
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${safeTitle}</title></head><body>${html}</body></html>`;
  return [
    {
      name: "mimetype",
      data: Buffer.from("application/epub+zip"),
      store: true,
    },
    {
      name: "META-INF/container.xml",
      data: xml(
        `<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
      ),
    },
    {
      name: "OEBPS/content.opf",
      data: xml(
        `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${safeTitle}</dc:title><dc:language>en</dc:language><dc:identifier id="id">yami</dc:identifier></metadata><manifest><item id="chap" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chap"/></spine></package>`,
      ),
    },
    { name: "OEBPS/chapter.xhtml", data: Buffer.from(chapter, "utf8") },
  ];
}

export function epubHtml(entries: { name: string; data: Buffer }[]) {
  const chapter = entries.find(
    (entry) =>
      /chapter\.xhtml$/i.test(entry.name) || /\.xhtml$/i.test(entry.name),
  );
  if (!chapter) throw new Error("That EPUB has no chapter.");
  const html = chapter.data.toString("utf8");
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return body ? body[1].trim() : html;
}

export function textToPdfLines(text: string) {
  return text.replace(/\r\n/g, "\n").split("\n").slice(0, 4000);
}

export function htmlDocument(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${body}</body></html>`;
}
