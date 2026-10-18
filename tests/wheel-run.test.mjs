import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { allocateFile, stemOf, toolBase } from "../src/wheel/naming.ts";
import {
  convertCommand,
  editMetadataCommand,
  stripMetadataCommand,
  videoTargetBitrate,
} from "../src/wheel/plans.ts";
import { packGzip, packTar, packZip, unpackGzip, unpackTar, unpackZip } from "../electron/wheel/archive.ts";
import { EngineStore } from "../electron/wheel/engines.ts";
import { imagesToPdf, mergePdf } from "../electron/wheel/pdf.ts";

test("new files keep the original name and add a counter when needed", () => {
  assert.equal(stemOf("archive.tar.gz"), "archive");
  assert.equal(stemOf("grove.png"), "grove");
  const taken = new Set([path.join("/tmp", "grove.jpg")]);
  assert.equal(
    allocateFile("/tmp", "grove", "jpg", (value) => taken.has(value)),
    path.join("/tmp", "grove 2.jpg"),
  );
  assert.equal(toolBase("grove.png", "Background"), "grove Background");
});

test("conversion commands stay on the chosen engine and refuse HEIC encoding", () => {
  const audio = convertCommand("audio", "mp3", "in.wav", "out.mp3");
  assert.equal(audio.engine, "ffmpeg");
  assert.ok(audio.args.includes("libmp3lame"));
  assert.equal(audio.args.at(-1), "out.mp3");
  const image = convertCommand("image", "png", "in.jpg", "out.png");
  assert.equal(image.engine, "magick");
  assert.equal(image.args[0], "in.jpg");
  assert.throws(() => convertCommand("image", "heic", "in.jpg", "out.heic"), /HEIC/);
  assert.deepEqual(stripMetadataCommand("image", "in.jpg", "out.jpg").args.slice(0, 2), ["-all=", "-o"]);
  assert.throws(() => editMetadataCommand("in.jpg", "out.jpg", [{ tag: "-all", value: "x" }]), /not allowed/);
  assert.equal(videoTargetBitrate(1_000_000, 10) > 80_000, true);
});

test("zip and tar round-trip and reject paths that escape the folder", () => {
  const zip = packZip([{ name: "notes/hello.txt", data: Buffer.from("hello") }]);
  assert.equal(unpackZip(zip)[0].data.toString(), "hello");
  const tar = packTar([{ name: "notes/hello.txt", data: Buffer.from("hello") }]);
  assert.equal(unpackTar(tar)[0].data.toString(), "hello");
  assert.equal(unpackGzip(packGzip(Buffer.from("zipped"))).toString(), "zipped");
  assert.throws(() => packZip([{ name: "../secret.txt", data: Buffer.from("no") }]), /unsafe/);
});

test("an engine download runs only when the pinned checksum matches", async () => {
  const payload = packZip([{ name: "bin/ffmpeg.exe", data: Buffer.from("MZ-fake") }]);
  const spec = {
    id: "ffmpeg",
    version: "test",
    license: "test",
    url: "https://example.test/ffmpeg.zip",
    sha256: createHash("sha256").update(payload).digest("hex"),
    format: "zip",
    exe: "ffmpeg.exe",
    source: "test",
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-engine-"));
  const store = new EngineStore(root, [spec], async () => new Response(payload));
  const exe = await store.ensure("ffmpeg");
  assert.equal(fs.readFileSync(exe, "utf8"), "MZ-fake");
  assert.equal(store.list()[0].installed, true);
  const again = await store.ensure("ffmpeg");
  assert.equal(again, exe);
  const bad = new EngineStore(
    fs.mkdtempSync(path.join(os.tmpdir(), "yami-engine-")),
    [{ ...spec, sha256: "ab".repeat(32) }],
    async () => new Response(payload),
  );
  await assert.rejects(() => bad.ensure("ffmpeg"), /checksum/);
});

test("pdf merge and image pages are real files", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-pdf-"));
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const first = path.join(root, "one.png");
  const second = path.join(root, "two.png");
  fs.writeFileSync(first, png);
  fs.writeFileSync(second, png);
  const pages = path.join(root, "pages.pdf");
  await imagesToPdf([first, second], pages);
  const { PDFDocument } = await import("pdf-lib");
  const made = await PDFDocument.load(fs.readFileSync(pages));
  assert.equal(made.getPageCount(), 2);
  const left = path.join(root, "left.pdf");
  const right = path.join(root, "right.pdf");
  fs.writeFileSync(left, await (await PDFDocument.create()).save());
  const extra = await PDFDocument.create();
  extra.addPage([20, 20]);
  fs.writeFileSync(right, await extra.save());
  const merged = path.join(root, "merged.pdf");
  await mergePdf([pages, right], merged);
  assert.equal((await PDFDocument.load(fs.readFileSync(merged))).getPageCount(), 3);
});
