export type StatusTone = "active" | "attention" | "good" | "problem" | "quiet";
/** Colour family for a status word, so chips read the same everywhere. */
export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (/error|fail|unavailable|denied|blocked/.test(s)) return "problem";
  if (/not connected|idle|\boff\b/.test(s)) return "quiet";
  if (/work|think|running|reading|record|sync|connecting/.test(s))
    return "active";
  if (/wait|auth|backoff|stale|pending|paused/.test(s)) return "attention";
  if (
    /finish|fresh|ready|done|connected|enabled|\bok\b|success|complete/.test(s)
  )
    return "good";
  return "quiet";
}
