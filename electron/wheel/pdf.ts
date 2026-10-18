import fs from "node:fs";

export async function mergePdf(inputs: string[], output: string) {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const input of inputs) {
    const source = await PDFDocument.load(await fs.promises.readFile(input));
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  await fs.promises.writeFile(output, await merged.save());
}

export async function imagesToPdf(inputs: string[], output: string) {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (const input of inputs) {
    const bytes = await fs.promises.readFile(input);
    const lower = input.toLowerCase();
    const image = lower.endsWith(".png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  await fs.promises.writeFile(output, await doc.save());
}
