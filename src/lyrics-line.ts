// Timed lyric lines, shared by the main process (parsing) and the media card
// (picking the line for the current position).

export type LyricLine = { at: number; text: string };

/** `[mm:ss.xx] words` lines into timed lines, in order. */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of lrc.split(/\r?\n/)) {
    const stamps = [
      ...row.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g),
    ];
    if (!stamps.length) continue;
    const text = row.replace(/\[[^\]]*\]/g, "").trim();
    for (const [, m, s, frac = "0"] of stamps)
      lines.push({
        at: Number(m) * 60 + Number(s) + Number(frac.padEnd(3, "0")) / 1000,
        text,
      });
  }
  return lines.sort((a, b) => a.at - b.at);
}

/** The line being sung at `position` seconds, or undefined before the first. */
export function currentLine(lines: LyricLine[], position: number) {
  let found: LyricLine | undefined;
  for (const line of lines) {
    if (line.at > position) break;
    found = line;
  }
  return found;
}
