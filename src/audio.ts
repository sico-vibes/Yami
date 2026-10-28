import { api } from "./api";
import type { Settings } from "./shared";
import { encodeBytes, pcmWav } from "./pcm-capture";
const base64 = (buffer: ArrayBuffer) => {
  const b = new Uint8Array(buffer);
  let text = "";
  for (let i = 0; i < b.length; i++) text += String.fromCharCode(b[i]);
  return btoa(text);
};
export class AudioEngine {
  stream?: MediaStream;
  context?: AudioContext;
  processor?: AudioWorkletNode;
  recorder?: MediaRecorder;
  output?: AudioContext;
  nextTime = 0;
  sources = new Set<AudioBufferSourceNode>();
  token = 0;
  mode = "";
  autoEnd = false;
  heardSpeech = false;
  lastSpeech = 0;
  inputStarted = 0;
  enableAutoEnd() {
    this.autoEnd = true;
    this.heardSpeech = false;
    this.lastSpeech = Date.now();
    this.inputStarted = Date.now();
  }
  constructor(
    private level: (v: number) => void,
    private error: (m: string) => void,
  ) {}
  async start(
    mode: "voice" | "dictation",
    settings: Settings,
    target = 0,
    autoEnd = false,
  ) {
    if (this.mode) return;
    const token = ++this.token;
    this.mode = mode;
    this.autoEnd = autoEnd;
    this.heardSpeech = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: settings.microphone
            ? { exact: settings.microphone }
            : undefined,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: settings.noiseSuppression,
        },
      });
      if (token !== this.token) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      if (mode === "voice") {
        await api("voice.start");
        if (token !== this.token) {
          await api("voice.stop");
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.context = new AudioContext({ sampleRate: 16000 });
        await this.context.audioWorklet.addModule(
          new URL("pcm-worklet.js", location.href).href,
        );
        if (token !== this.token) return;
        this.inputStarted = Date.now();
        this.lastSpeech = Date.now();
        const source = this.context.createMediaStreamSource(stream);
        this.processor = new AudioWorkletNode(this.context, "pcm-processor");
        this.processor.port.onmessage = (e) => {
          if (token !== this.token) return;
          this.level(e.data.level);
          void api("voice.audio", { data: base64(e.data.pcm) }).catch((err) =>
            this.error(err.message),
          );
          if (this.autoEnd) {
            const now = Date.now();
            if (e.data.level > 0.015) {
              this.heardSpeech = true;
              this.lastSpeech = now;
            }
            if (
              (this.heardSpeech && now - this.lastSpeech > 900) ||
              now - this.inputStarted > 20000
            )
              this.stop();
          }
        };
        source.connect(this.processor);
        this.processor.connect(this.context.destination);
      } else {
        const chunks: Blob[] = [];
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        this.recorder = new MediaRecorder(stream, { mimeType });
        this.recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        this.recorder.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size < 500) return;
            // Offline engines take 16 kHz PCM WAV; Gemini takes the recording as is.
            if (settings.dictationEngine !== "gemini") {
              const decoder = new AudioContext({ sampleRate: 16000 });
              try {
                const audio = await decoder.decodeAudioData(await blob.arrayBuffer());
                const pcm = new Int16Array(audio.length), channel = audio.getChannelData(0);
                for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-1, Math.min(1, channel[i])) * 32767;
                await api("dictation", { data: encodeBytes(pcmWav([new Uint8Array(pcm.buffer)])), mimeType: "audio/wav", target });
              } finally { await decoder.close(); }
              return;
            }
            await api("dictation", {
              data: base64(await blob.arrayBuffer()),
              mimeType: "audio/webm",
              target,
            });
          } catch (e) {
            this.error((e as Error).message);
          }
        };
        this.recorder.start();
      }
    } catch (e) {
      const cancelled = token !== this.token;
      this.mode = "";
      this.stop(true);
      if (!cancelled) this.error((e as Error).message);
    }
  }
  stop(cancel = false) {
    if (cancel) this.clear();
    ++this.token;
    const was = this.mode;
    this.mode = "";
    if (this.recorder?.state === "recording") {
      if (cancel) this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.recorder = undefined;
    this.processor?.disconnect();
    this.context?.close().catch(() => {});
    this.context = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.level(0);
    if (was === "voice")
      void api(cancel ? "voice.stop" : "voice.endAudio").catch((e) =>
        this.error(e.message),
      );
  }
  play(data: string) {
    this.output ||= new AudioContext({ sampleRate: 24000 });
    void this.output.resume();
    const raw = atob(data);
    const pcm = new Int16Array(raw.length / 2);
    for (let i = 0; i < pcm.length; i++)
      pcm[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
    const buffer = this.output.createBuffer(1, pcm.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
    const source = this.output.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output.destination);
    this.nextTime = Math.max(this.output.currentTime, this.nextTime);
    source.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }
  clear() {
    for (const s of this.sources)
      try {
        s.stop();
      } catch {}
    this.sources.clear();
    this.nextTime = 0;
  }
}
