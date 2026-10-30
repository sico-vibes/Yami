import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { convertOffice } from "../electron/wheel/convert-docs.ts";
import { packZip, unpackTar, unpackZip } from "../electron/wheel/archive.ts";
import { docxText } from "../src/wheel/office-xml.ts";
import { sofficeArgs } from "../src/wheel/soffice.ts";

async function convert(name, body, target) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-office-"));
  const input = path.join(root, name);
  const output = path.join(root, `out.${target}`);
  await fs.promises.writeFile(input, body);
  await convertOffice(input, name, output, target, () => undefined);
  return output;
}

test("subtitles, markdown, and archives convert without an external engine", async () => {
  const vtt = await fs.promises.readFile(
    await convert(
      "captions.srt",
      "1\n00:00:01,000 --> 00:00:02,500\nHello grove\n",
      "vtt",
    ),
    "utf8",
  );
  assert.match(vtt, /WEBVTT/);
  assert.match(vtt, /00:00:01.000 --> 00:00:02.500/);
  const html = await fs.promises.readFile(
    await convert("notes.md", "# Grove\n\nA **tree**.", "html"),
    "utf8",
  );
  assert.match(html, /<h1>Grove<\/h1>/);
  assert.match(html, /<strong>tree<\/strong>/);
  const zip = packZip([
    { name: "notes/hello.txt", data: Buffer.from("hello") },
  ]);
  const tarPath = await convert("bundle.zip", zip, "tar");
  assert.equal(
    unpackTar(await fs.promises.readFile(tarPath))[0].data.toString(),
    "hello",
  );
});

test("docx, xlsx, epub, and pdf text round-trip", async () => {
  const docx = await convert("notes.txt", "Grove\n\nSecond", "docx");
  assert.match(docxText(unpackZip(await fs.promises.readFile(docx))), /Grove/);
  const sheet = await convert("rows.csv", "name,count\ngrove,2\n", "xlsx");
  const csv = await fs.promises.readFile(
    await convert(
      path.basename(sheet),
      await fs.promises.readFile(sheet),
      "csv",
    ),
    "utf8",
  );
  assert.match(csv, /grove/);
  const epub = await convert("notes.txt", "Grove chapter", "epub");
  const html = await fs.promises.readFile(
    await convert("notes.epub", await fs.promises.readFile(epub), "html"),
    "utf8",
  );
  assert.match(html, /Grove chapter/);
  const pdf = await convert("notes.txt", "grove", "pdf");
  const text = await fs.promises.readFile(
    await convert("notes.pdf", await fs.promises.readFile(pdf), "txt"),
    "utf8",
  );
  assert.match(text, /grove/);
});

test("LibreOffice is a separate process and is not required for the text path", () => {
  assert.deepEqual(sofficeArgs("in.pptx", "C:\\out", "pdf").slice(0, 3), [
    "--headless",
    "--norestore",
    "--convert-to",
  ]);
  assert.equal(sofficeArgs("in.pptx", "C:\\out", "png").includes("png"), true);
});
