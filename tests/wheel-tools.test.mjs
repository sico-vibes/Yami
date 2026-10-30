import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { adjustDefaults, adjustRgba } from "../src/wheel/adjust.ts";
import {
  bleepCommand,
  channelsCommand,
  concatList,
  muteCommand,
  parseLoudnorm,
  speedCommand,
  videoCropCommand,
  videoRedactCommand,
} from "../src/wheel/media-plans.ts";
import { organizePdf, splitPdf } from "../electron/wheel/pdf-pages.ts";
import { readQr } from "../src/wheel/qr-read.ts";

test("media plans stay inside ffmpeg and reject bad ranges", () => {
  assert.ok(muteCommand("in.mp4", "out.mp4").args.includes("-an"));
  const speed = speedCommand("in.mp4", "out.mp4", 2);
  assert.match(speed.args.join(" "), /setpts=0\.5000\*PTS/);
  assert.match(speed.args.join(" "), /atempo=2\.0000/);
  assert.throws(() => speedCommand("in.mp4", "out.mp4", 4), /Speed/);
  assert.ok(
    videoCropCommand("in.mp4", "out.mp4", { x: 1, y: 2, w: 100, h: 80 })
      .args.join(" ")
      .includes("crop=100:80:1:2"),
  );
  const hidden = videoRedactCommand("in.mp4", "out.mp4", [
    { x: 4, y: 6, w: 20, h: 10, start: 1, end: 2, mode: "blur" },
  ]);
  assert.match(hidden.args.join(" "), /between\(t,1,2\)/);
  assert.match(
    bleepCommand("in.wav", "out.wav", 1, 2, 1000).args.join(" "),
    /sine=frequency=1000/,
  );
  assert.match(
    channelsCommand("in.wav", "out.wav", "mono", 1, 1).args.join(" "),
    /-ac/,
  );
  assert.equal(
    concatList(["C:\\a.mp4", "it's.mp4"]),
    "file 'C:/a.mp4'\nfile 'it'\\''s.mp4'",
  );
  assert.throws(() => concatList(["a\nb.mp4"]), /cannot be joined/);
});

test("loudnorm JSON from ffmpeg stderr becomes the second pass", () => {
  const measured = parseLoudnorm(
    `noise\n{\n"input_i" : "-23.5",\n"input_tp" : "-7.5",\n"input_lra" : "5.2",\n"input_thresh" : "-34",\n"target_offset" : "0.5"\n}\n`,
  );
  assert.equal(measured.i, -23.5);
  assert.equal(parseLoudnorm("no json"), null);
});

test("adjust sliders change pixels and leave an untouched copy alone", () => {
  const pixels = new Uint8ClampedArray([255, 255, 255, 255, 10, 10, 10, 255]);
  const same = adjustRgba(pixels, 2, 1, adjustDefaults);
  assert.equal(same[0], 255);
  const darker = adjustRgba(pixels, 2, 1, {
    ...adjustDefaults,
    exposure: -100,
  });
  assert.ok(darker[0] < 200);
  const shaded = adjustRgba(pixels, 2, 1, { ...adjustDefaults, vignette: 100 });
  assert.ok(shaded[0] < shaded[4]);
});

test("pdf split and organize keep the requested pages", async () => {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-pages-"));
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  for (const word of ["one", "two"]) {
    const page = source.addPage([200, 200]);
    page.drawText(word, { x: 20, y: 20, size: 24, font });
  }
  const file = path.join(root, "notes.pdf");
  fs.writeFileSync(file, await source.save());
  const folder = path.join(root, "out");
  fs.mkdirSync(folder);
  const pages = await splitPdf(file, folder, "notes");
  assert.equal(pages.length, 2);
  const organized = path.join(root, "organized.pdf");
  await organizePdf(file, organized, [
    { sourceIndex: 1, rotation: 90 },
    { sourceIndex: 1, rotation: 0 },
  ]);
  const result = await PDFDocument.load(fs.readFileSync(organized));
  assert.equal(result.getPageCount(), 2);
  assert.equal(result.getPage(0).getRotation().angle, 90);
});

test("a drawn QR code round-trips through the reader", async () => {
  const QRCode = (await import("qrcode")).default;
  const created = QRCode.create("grove", { errorCorrectionLevel: "M" });
  const quiet = 4;
  const scale = 6;
  const modules = created.modules.size;
  const size = (modules + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  data.fill(255);
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      if (!created.modules.get(x, y)) continue;
      for (let py = 0; py < scale; py += 1) {
        for (let px = 0; px < scale; px += 1) {
          const index =
            ((y + quiet) * scale + py) * size + ((x + quiet) * scale + px);
          data[index * 4] = 0;
          data[index * 4 + 1] = 0;
          data[index * 4 + 2] = 0;
        }
      }
    }
  }
  assert.equal(await readQr(data, size, size), "grove");
});
