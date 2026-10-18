class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frames = [];
    this.count = 0;
    this.port.onmessage = (e) => {
      if (e.data === "flush") {
        this.flush();
        this.port.postMessage({ flushed: true });
      }
    };
  }
  flush() {
    if (!this.count) return;
    const pcm = new Int16Array(this.count);
    let at = 0,
      sum = 0;
    for (const frame of this.frames)
      for (const x of frame) {
        pcm[at++] = Math.max(-1, Math.min(1, x)) * 32767;
        sum += x * x;
      }
    this.port.postMessage(
      { pcm: pcm.buffer, level: Math.sqrt(sum / this.count) },
      [pcm.buffer],
    );
    this.frames = [];
    this.count = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) {
      this.frames.push(new Float32Array(input));
      this.count += input.length;
      if (this.count >= 2048) this.flush();
    }
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
