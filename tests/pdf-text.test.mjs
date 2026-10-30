import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfToText } from "../electron/wheel/pdf-text.ts";

test("text comes out of a PDF, page by page", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage().drawText("Hello from Yami", { x: 50, y: 700, font, size: 18 });
  doc.addPage().drawText("Second page", { x: 50, y: 700, font, size: 18 });
  const text = await pdfToText(Buffer.from(await doc.save()));
  assert.match(text, /Hello from Yami/);
  assert.match(text, /Second page/);
  assert.ok(text.indexOf("Hello") < text.indexOf("Second"));
});
