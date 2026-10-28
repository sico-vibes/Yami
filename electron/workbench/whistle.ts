// Cactus Whistle through the Needle engine's command-line runner. The flags
// are the documented ones (`--model`, `--audio`); keyword biasing and a forced
// language exist in the engine's C API but no runner flag is documented, so
// they are not passed.

export function whistleArgs(model: string, wav: string) {
  return ["--model", model, "--audio", wav];
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
