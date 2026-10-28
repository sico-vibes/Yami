// Frames for the AsciiSkeleton loading line; pure, so it is testable.

const glyphs = "·:+*✦░▒";
export const frames = 21;

/** The label with the letters not yet revealed shown as glyphs. */
export function revealFrame(label: string, frame: number, total = frames) {
  const shown = Math.floor((label.length * frame) / total);
  let out = "";
  for (let i = 0; i < label.length; i++)
    out +=
      i < shown || label[i] === " "
        ? label[i]
        : glyphs[(i * 7 + frame * 3) % glyphs.length];
  return out;
}
