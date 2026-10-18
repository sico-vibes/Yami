type Cue = { start: string; end: string; text: string };

function stamp(value: string, vtt: boolean) {
  const match = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/.exec(value);
  if (!match) throw new Error("That subtitle timestamp is not readable.");
  return `${match[1]}:${match[2]}:${match[3]}${vtt ? "." : ","}${match[4]}`;
}

export function parseCues(text: string): Cue[] {
  const body = text.replace(/^\uFEFF/, "").replace(/^WEBVTT[^\n]*\n+/i, "");
  const cues: Cue[] = [];
  for (const block of body.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter((line) => line.trim() && !/^\d+$/.test(line.trim()));
    const timing = lines.find((line) => line.includes("-->"));
    if (!timing) continue;
    const [start, end] = timing.split("-->").map((part) => part.trim().split(" ")[0]);
    const words = lines.slice(lines.indexOf(timing) + 1).join("\n").trim();
    if (start && end && words) cues.push({ start, end, text: words });
  }
  return cues;
}

export function convertSubtitle(text: string, target: string) {
  const cues = parseCues(text);
  if (!cues.length) throw new Error("No subtitle cues were found.");
  if (target === "txt") return cues.map((cue) => cue.text).join("\n\n");
  const vtt = target === "vtt";
  const body = cues
    .map((cue, index) => {
      const row = `${stamp(cue.start, vtt)} --> ${stamp(cue.end, vtt)}\n${cue.text}`;
      return vtt ? row : `${index + 1}\n${row}`;
    })
    .join("\n\n");
  return vtt ? `WEBVTT\n\n${body}\n` : `${body}\n`;
}
