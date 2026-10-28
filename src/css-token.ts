// Canvas and xterm cannot use CSS variables directly, so they read the
// Nightglow tokens from the document.
export function cssToken(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
