// Desktop check for the file wheel's engines: makes a small PNG and a WAV,
// then converts them from the wheel (PNG → JPG with ImageMagick, WAV → MP3
// with ffmpeg). The first use downloads each engine through the pinned
// downloader (about 140 MB together). Isolated profile; prints the outputs.
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/wheel-engines-" + Date.now());
skipSetup(profile);
const work = path.join(profile, "work");
fs.mkdirSync(work, { recursive: true });

/** A 64×64 gradient PNG written by hand (no image library needed). */
function png(file) {
  const w = 64,
    h = 64;
  const rows = [];
  for (let y = 0; y < h; y++) {
    rows.push(0);
    for (let x = 0; x < w; x++) rows.push(x * 4, y * 4, 160);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(Buffer.from(rows))),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

/** One second of a 440 Hz tone, 16-bit mono WAV. */
function wav(file) {
  const rate = 16000,
    samples = rate;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++)
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), i * 2);
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([head, data]));
}

// Optional: reuse engines another run already downloaded (all but ImageMagick,
// so its install runs again), to skip the long ffmpeg download.
const reuse = process.argv[2];
if (reuse)
  for (const id of fs.readdirSync(reuse))
    if (id !== "magick")
      fs.cpSync(path.join(reuse, id), path.join(profile, "engines", id), {
        recursive: true,
      });
const image = path.join(work, "gradient.png");
const tone = path.join(work, "tone.wav");
png(image);
wav(tone);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = {};
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (m, a) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  for (const [file, petal, engine] of [
    [image, "to:jpg", "ImageMagick"],
    [tone, "to:mp3", "ffmpeg"],
  ]) {
    await call("wheel.shelf.drop", { paths: [file] });
    await call("wheel.swap", { mode: "convert" });
    const started = Date.now();
    const result = await call("wheel.choose", { petalId: petal }).catch(
      (e) => ({ error: e.message }),
    );
    const out = result.outputs?.[0];
    results[engine] = {
      ms: Date.now() - started,
      ...(out ? { output: path.basename(out), bytes: fs.statSync(out).size } : result),
    };
  }
  assert.ok(results.ImageMagick.output?.endsWith(".jpg"), JSON.stringify(results));
  assert.ok(results.ffmpeg.output?.endsWith(".mp3"), JSON.stringify(results));
  assert.ok(results.ffmpeg.bytes > 1000 && results.ImageMagick.bytes > 300);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, results }));
} catch (error) {
  console.log(JSON.stringify({ passed: false, results, error: error.message }));
  process.exitCode = 1;
} finally {
  await app.close();
}
