// Cactus Whistle through the Needle engine's command-line runner. The flags
// are the ones `needle.exe --help` lists (checked 2026-10-28 on the pinned
// build): English is forced, since Yami's Whistle dictation is English only,
// and the words from Your words are passed as keywords to favour.

export function whistleArgs(model: string, wav: string, keywords?: string) {
  return [
    "--model",
    model,
    "--audio",
    wav,
    "--audio-language",
    "en",
    ...(keywords ? ["--audio-keywords", keywords] : []),
  ];
}

/** The words to favour: what dictionary entries turn speech into. */
export function whistleKeywords(
  rules: { replacement: string; kind: string }[],
) {
  const words = new Set<string>();
  for (const r of rules)
    if (r.kind === "word" && r.replacement.trim() && r.replacement.length <= 80)
      words.add(r.replacement.trim().replace(/\s+/g, " "));
  return [...words].slice(0, 200);
}

/**
 * The runner's transcript. The engine returns a JSON object with `text`
 * (`audio_text` when Needle runs with it); plain text is accepted too.
 */
export function parseWhistle(stdout: string) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    try {
      const result = JSON.parse(line);
      const text = result.text ?? result.audio_text;
      if (typeof text === "string") return text.trim();
    } catch {}
  }
  try {
    const whole = JSON.parse(stdout);
    const text = whole?.text ?? whole?.audio_text;
    if (typeof text === "string") return text.trim();
  } catch {}
  return lines.join(" ").trim();
}
