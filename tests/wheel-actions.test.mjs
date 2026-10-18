import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { copyFileArguments, destinationFor, pathText, terminalLaunch } from "../src/wheel/actions.ts";
import { heicEncodeAvailable } from "../src/wheel/heic.ts";
import { convertCommand } from "../src/wheel/plans.ts";

test("file actions quote paths and keep compound names", () => {
  assert.equal(pathText(["C:\\Photos\\grove.png"]), "C:\\Photos\\grove.png");
  assert.deepEqual(copyFileArguments(["C:\\it's.png"]), [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Set-Clipboard -LiteralPath 'C:\\it''s.png'",
  ]);
  assert.throws(() => copyFileArguments(["a\nb.png"]), /PowerShell/);
  const launch = terminalLaunch("C:\\Photos");
  assert.equal(launch.command, "powershell.exe");
  assert.match(launch.args.at(-1), /Set-Location -LiteralPath 'C:\\Photos'/);
  const taken = new Set([path.join("/tmp", "archive.tar.gz")]);
  assert.equal(
    destinationFor("/tmp", "archive.tar.gz", (value) => taken.has(value)),
    path.join("/tmp", "archive 2.tar.gz"),
  );
});

test("HEIC encoding stays off unless ffmpeg reports both an encoder and a muxer", () => {
  assert.equal(heicEncodeAvailable("libx265", "hevc"), false);
  assert.equal(heicEncodeAvailable("libx264", "heif"), false);
  assert.equal(heicEncodeAvailable(" V....D libx265", " E heic "), true);
  assert.throws(() => convertCommand("image", "heic", "in.jpg", "out.heic"), /HEIC/);
  const command = convertCommand("image", "heic", "in.jpg", "out.heic", true);
  assert.equal(command.engine, "ffmpeg");
  assert.ok(command.args.includes("libx265"));
});
