import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseWhistle,
  whistleArgs,
  whistleKeywords,
} from "../electron/workbench/whistle.ts";
import { EngineStore } from "../electron/wheel/engines.ts";
import { engines } from "../electron/wheel/engine-catalog.ts";
import { modules } from "../src/modules.ts";

test("Whistle runs English only, with Your words as keywords", () => {
  assert.deepEqual(whistleArgs("C:\\m\\whistle.cact", "C:\\t\\a.wav"), [
    "--model",
    "C:\\m\\whistle.cact",
    "--audio",
    "C:\\t\\a.wav",
    "--audio-language",
    "en",
  ]);
  assert.deepEqual(
    whistleArgs("m.cact", "a.wav", "C:\\t\\keywords.txt").slice(-2),
    ["--audio-keywords", "C:\\t\\keywords.txt"],
  );
  assert.deepEqual(
    whistleKeywords([
      { kind: "word", replacement: "Yami" },
      { kind: "word", replacement: "  Basem  Hesham " },
      { kind: "word", replacement: "Yami" },
      { kind: "snippet", replacement: "Long reply text" },
    ]),
    ["Yami", "Basem Hesham"],
  );
});

test("the transcript is read from JSON or plain output", () => {
  assert.equal(
    parseWhistle(
      '{"text":" turn off the kitchen lights ","language":"en","ttft_ms":11}\n',
    ),
    "turn off the kitchen lights",
  );
  assert.equal(
    parseWhistle(
      'loading whistle.cact\r\n{"audio_text":"hello there","calls":[]}\r\n',
    ),
    "hello there",
  );
  assert.equal(
    parseWhistle('{\n  "text": "pretty printed",\n  "language": "en"\n}'),
    "pretty printed",
  );
  assert.equal(parseWhistle("plain words\n"), "plain words");
  assert.equal(parseWhistle('{"text":""}'), "");
});

test("Whistle's packs are pinned files a module owns", async () => {
  const needle = engines.find((e) => e.id === "needle");
  const whistle = engines.find((e) => e.id === "whistle");
  for (const spec of [needle, whistle]) {
    assert.match(
      spec.url,
      /^https:\/\/huggingface\.co\/Cactus-Compute\/[a-z0-9]+\/resolve\/[0-9a-f]{40}\//,
    );
    assert.match(spec.sha256, /^[0-9a-f]{64}$/);
    assert.match(spec.license, /^Apache-2\.0/);
  }
  assert.deepEqual(modules.find((m) => m.id === "whistle").packs, [
    "needle",
    "whistle",
  ]);
  const payload = Buffer.from("model bytes");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-whistle-"));
  const store = new EngineStore(
    root,
    [
      {
        ...whistle,
        sha256: createHash("sha256").update(payload).digest("hex"),
      },
    ],
    async () => new Response(payload),
  );
  const file = await store.ensure("whistle");
  assert.equal(path.basename(file), "whistle.cact");
  assert.equal(fs.readFileSync(file, "utf8"), "model bytes");
});
