// Where the desk widget card sits; kept apart from Electron for the tests.
export const SIZE = { width: 320, height: 208 };
export const MARGIN = 24;

/** Where the card goes: its saved spot if a screen still shows it. */
export function widgetSpot(
  saved: string,
  areas: { x: number; y: number; width: number; height: number }[],
) {
  const [x, y] = saved.split(",").map(Number);
  const fits = (a: (typeof areas)[number]) =>
    x >= a.x &&
    y >= a.y &&
    x + SIZE.width <= a.x + a.width &&
    y + SIZE.height <= a.y + a.height;
  if (Number.isFinite(x) && Number.isFinite(y) && areas.some(fits))
    return { x, y };
  const main = areas[0];
  return {
    x: main.x + main.width - SIZE.width - MARGIN,
    y: main.y + MARGIN,
  };
}
