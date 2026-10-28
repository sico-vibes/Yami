import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { SpeechController } from "./speech";
import type { WebContents } from "electron";
import type { WorkbenchSettings } from "../../src/workbench-types";
export function wavHeader(bytes: number) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(bytes + 36, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(bytes, 40);
  return h;
}
type Recording = {
  owner: number;
  dir: string;
  bytes: number;
  queue: Promise<void>;
  engine: WorkbenchSettings["dictationEngine"];
  cancelled: boolean;
  finishing: boolean;
};
export class Meetings {
  private starting = false;
  private recordings = new Map<string, Recording>();
  constructor(private speech: SpeechController) {}
  get active() {
    return this.recordings.size > 0;
  }
  async start(
    sender: WebContents,
    consent: boolean,
    engine: WorkbenchSettings["dictationEngine"],
  ) {
    if (!consent)
      throw new Error("Confirm that participants know you are recording.");
    if (this.recordings.size || this.starting)
      throw new Error("Finish the current recording first.");
    this.starting = true;
    let dir: string;
    try {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "yami-meeting-"));
    } finally {
      this.starting = false;
    }
    const id = randomUUID();
    const entry: Recording = {
      owner: sender.id,
      dir,
      bytes: 0,
      queue: Promise.resolve(),
      engine,
      cancelled: false,
      finishing: false,
    };
    this.recordings.set(id, entry);
    sender.once("destroyed", () => {
      void this.cancel(id);
    });
    return { id };
  }
  private owned(id: string, sender: WebContents) {
    const r = this.recordings.get(id);
    if (!r || r.owner !== sender.id || r.cancelled)
      throw new Error("Recording is no longer available.");
    return r;
  }
  chunk(id: string, data: string, sender: WebContents) {
    const r = this.owned(id, sender);
    if (r.finishing) throw new Error("Recording is already being transcribed.");
    if (data.length > 180000) throw new Error("Recording chunk is too large.");
    const bytes = Buffer.from(data, "base64");
    if (bytes.length % 2) throw new Error("Invalid PCM chunk.");
    if (r.bytes + bytes.length > 250 * 1024 * 1024)
      throw new Error(
        "Recording reached its two-hour storage budget. Stop and transcribe this recording before starting another.",
      );
    r.bytes += bytes.length;
    r.queue = r.queue.then(() =>
      fs.appendFile(path.join(r.dir, "audio.pcm"), bytes, { mode: 0o600 }),
    );
    return r.queue;
  }
  async finish(
    id: string,
    sender: WebContents,
    commit?: (text: string) => Promise<void>,
  ) {
    const r = this.owned(id, sender);
    if (r.finishing) throw new Error("Recording is already being transcribed.");
    r.finishing = true;
    try {
      await r.queue;
      if (r.bytes < 1600) {
        await this.cancel(id);
        throw new Error("Recording was too short to transcribe.");
      }
      const file = await fs.open(path.join(r.dir, "audio.pcm"), "r");
      const texts: string[] = [];
      let completed = false;
      try {
        const segment = 5 * 60 * 32000;
        for (let offset = 0; offset < r.bytes; offset += segment) {
          if (r.cancelled) throw new Error("Transcription cancelled.");
          const chunk = Buffer.alloc(Math.min(segment, r.bytes - offset));
          const { bytesRead } = await file.read(chunk, 0, chunk.length, offset);
          const wav = Buffer.concat([
            wavHeader(bytesRead),
            chunk.subarray(0, bytesRead),
          ]);
          texts.push(
            await this.speech.transcribe(
              wav.toString("base64"),
              "audio/wav",
              r.engine,
              id,
            ),
          );
        }
        if (r.cancelled) throw new Error("Transcription cancelled.");
        const text = texts.join("\n\n");
        if (commit) await commit(text);
        completed = true;
        return text;
      } finally {
        await file.close();
        if (completed || r.cancelled) await this.cancel(id);
      }
    } finally {
      r.finishing = false;
    }
  }
  async cancel(id: string, sender?: WebContents) {
    const r = this.recordings.get(id);
    if (!r) return;
    if (sender && r.owner !== sender.id)
      throw new Error("This recording belongs to another window.");
    r.cancelled = true;
    this.speech.cancel(id);
    await r.queue.catch(() => {});
    this.recordings.delete(id);
    const resolved = path.resolve(r.dir),
      prefix = path.join(os.tmpdir(), "yami-meeting-");
    if (!resolved.startsWith(prefix))
      throw new Error("Invalid recording cleanup path.");
    await fs.rm(resolved, { recursive: true, force: true });
  }
  dispose() {
    for (const id of this.recordings.keys()) void this.cancel(id);
  }
}
