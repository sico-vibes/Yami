import { api } from "./api";
export const encodeBytes = (bytes: Uint8Array) => {
  let value = "";
  for (let i = 0; i < bytes.length; i += 8192)
    value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
};
export function pcmWav(parts: Uint8Array[]) {
  const size = parts.reduce((n, part) => n + part.length, 0),
    out = new Uint8Array(44 + size),
    view = new DataView(out.buffer);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) out[at + i] = value.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, size + 36, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, size, true);
  let offset = 44;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
export class PcmCapture {
  private streams: MediaStream[] = [];
  private context?: AudioContext;
  private node?: AudioWorkletNode;
  private pending = Promise.resolve();
  private queued = 0;
  private flushed?: () => void;
  private stopped = false;
  constructor(
    private chunk: (bytes: Uint8Array) => Promise<void>,
    private error: (error: Error) => void,
  ) {}
  async start(microphone = true, system = false) {
    try {
      const state = await api("state");
      if (microphone)
        this.streams.push(
          await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: state.settings.microphone
                ? { exact: state.settings.microphone }
                : undefined,
              channelCount: 1,
              noiseSuppression: state.settings.noiseSuppression,
              echoCancellation: true,
            },
          }),
        );
      if (system) {
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        this.streams.push(display);
        if (!display.getAudioTracks().length)
          throw new Error(
            "Windows did not supply system audio. Disable system audio or choose an available capture source.",
          );
        display.getVideoTracks().forEach((t) => t.stop());
      }
      if (!this.streams.length)
        throw new Error("Choose a microphone or system audio.");
      this.context = new AudioContext({ sampleRate: 16000 });
      await this.context.audioWorklet.addModule(
        new URL("pcm-worklet.js", location.href).href,
      );
      this.node = new AudioWorkletNode(this.context, "pcm-processor");
      this.node.port.onmessage = (e) => {
        if (e.data.flushed) {
          this.flushed?.();
          return;
        }
        if (!e.data.pcm || this.stopped) return;
        const bytes = new Uint8Array(e.data.pcm);
        this.queued += bytes.length;
        if (this.queued > 1048576) {
          this.error(
            new Error("Recording storage cannot keep up. Stop the recording."),
          );
          return;
        }
        this.pending = this.pending
          .then(() => this.chunk(bytes))
          .catch((error) => this.error(error))
          .finally(() => {
            this.queued -= bytes.length;
          });
      };
      for (const stream of this.streams)
        if (stream.getAudioTracks().length)
          this.context
            .createMediaStreamSource(new MediaStream(stream.getAudioTracks()))
            .connect(this.node);
      this.node.connect(this.context.destination);
    } catch (e) {
      await this.stop();
      throw e;
    }
  }
  async stop() {
    for (const stream of this.streams)
      stream.getTracks().forEach((t) => t.stop());
    this.streams = [];
    if (this.node)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 500);
        this.flushed = () => {
          clearTimeout(timeout);
          resolve();
        };
        this.node!.port.postMessage("flush");
      });
    this.stopped = true;
    this.node?.disconnect();
    await this.context?.close().catch(() => {});
    this.context = undefined;
    await this.pending;
  }
}
