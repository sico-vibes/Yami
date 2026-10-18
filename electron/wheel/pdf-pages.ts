import fs from "node:fs";
import path from "node:path";

export type PageEdit = { sourceIndex: number; rotation: 0 | 90 | 180 | 270 };

async function load(file: string) {
  const { PDFDocument } = await import("pdf-lib");
  return PDFDocument.load(await fs.promises.readFile(file));
}

export async function pageCount(file: string) {
  return (await load(file)).getPageCount();
}

export async function splitPdf(file: string, directory: string, base: string) {
  const source = await load(file);
  const total = source.getPageCount();
  if (!total) throw new Error("That PDF has no pages.");
  if (total > 200) throw new Error("Splitting stops at 200 pages.");
  const { PDFDocument } = await import("pdf-lib");
  const outputs: string[] = [];
  for (let index = 0; index < total; index += 1) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(source, [index]);
    doc.addPage(page);
    const output = path.join(directory, `${base} ${index + 1}.pdf`);
    await fs.promises.writeFile(output, await doc.save());
    outputs.push(output);
  }
  return outputs;
}

export async function organizePdf(file: string, output: string, pages: PageEdit[]) {
  if (!pages.length) throw new Error("Keep at least one page.");
  if (pages.length > 200) throw new Error("Organizing stops at 200 pages.");
  const source = await load(file);
  const total = source.getPageCount();
  const indexes = pages.map((page) => {
    if (!Number.isInteger(page.sourceIndex) || page.sourceIndex < 0 || page.sourceIndex >= total)
      throw new Error("That page is not in the PDF.");
    if (![0, 90, 180, 270].includes(page.rotation))
      throw new Error("Rotation has to be a quarter turn.");
    return page.sourceIndex;
  });
  const { PDFDocument, degrees } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const copied = await doc.copyPages(source, indexes);
  copied.forEach((page, index) => {
    page.setRotation(degrees(pages[index].rotation));
    doc.addPage(page);
  });
  await fs.promises.writeFile(output, await doc.save());
}
