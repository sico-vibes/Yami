// What the phone may send to the PC through Yami Remote's screen view. Only
// these shapes pass; everything else is refused before it reaches Windows.

export const remoteKeys = [
  "enter",
  "backspace",
  "tab",
  "escape",
  "space",
  "left",
  "up",
  "right",
  "down",
] as const;

export function parseRemoteInput(body: unknown): {
  method: "remoteClick" | "remoteScroll" | "remoteKey" | "remoteType";
  args: Record<string, unknown>;
} {
  const a = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const fraction = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1)
      throw new Error("Tap inside the screen.");
    return n;
  };
  if (a.kind === "click")
    return {
      method: "remoteClick",
      args: {
        x: fraction(a.x),
        y: fraction(a.y),
        button: a.button === "right" ? "right" : "left",
      },
    };
  if (a.kind === "scroll") {
    const notches = Math.trunc(Number(a.notches));
    if (!notches || Math.abs(notches) > 10)
      throw new Error("Scroll up to ten steps at a time.");
    return { method: "remoteScroll", args: { notches } };
  }
  if (a.kind === "key") {
    if (!remoteKeys.includes(a.key as (typeof remoteKeys)[number]))
      throw new Error("That key is not offered.");
    return { method: "remoteKey", args: { key: a.key } };
  }
  if (a.kind === "type") {
    const text = String(a.text ?? "");
    if (!text || text.length > 2000)
      throw new Error("Type up to 2,000 characters.");
    return { method: "remoteType", args: { text } };
  }
  throw new Error("Unknown input.");
}
