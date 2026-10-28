// Finds Windows paths in terminal output; kept apart from the UI for tests.

/** Absolute Windows paths in a line of output, with their columns. */
export function findPaths(line: string) {
  const out: { path: string; start: number; end: number }[] = [];
  const re = /(?:[A-Za-z]:\\|\\\\[^\\\s]+\\)[^\s"'<>|*?]+/g;
  for (const m of line.matchAll(re)) {
    // Trailing punctuation and a ":line:col" suffix are not part of the path.
    const path = m[0]
      .replace(/[.,;:)\]}]+$/, "")
      .replace(/(:\d+)+$/, "")
      .replace(/[.,;:)\]}]+$/, "");
    if (path.length > 3)
      out.push({ path, start: m.index!, end: m.index! + path.length });
  }
  return out;
}
