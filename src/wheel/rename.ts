// Batch rename for the file wheel. A pattern such as "holiday-{n}" names each
// file in order; {name} keeps the original name. Extensions are always kept.

const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function splitName(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0
    ? { stem: name.slice(0, dot), ext: name.slice(dot) }
    : { stem: name, ext: "" };
}

/** New names for `names`, in order, or an error saying what is wrong. */
export function renamePlan(names: string[], pattern: string, start = 1) {
  const p = pattern.trim();
  if (!p) throw new Error("Type a name pattern, for example holiday-{n}.");
  if (/[\\/:*?"<>|]/.test(p.replace(/\{n\}|\{name\}/g, "")))
    throw new Error('Names cannot contain \\ / : * ? " < > |');
  const width = String(start + names.length - 1).length;
  const numbered = p.includes("{n}") || names.length === 1;
  const out = names.map((name, i) => {
    const { stem, ext } = splitName(name);
    const n = String(start + i).padStart(Math.max(2, width), "0");
    let next = p.replace(/\{n\}/g, n).replace(/\{name\}/g, stem);
    // Without {n}, files would clash, so a number is added after the pattern.
    if (!numbered) next += "-" + n;
    next = next.replace(/[. ]+$/, "");
    if (!next || reserved.test(next))
      throw new Error(`"${next || p}" is not a usable file name.`);
    return { from: name, to: next + ext };
  });
  const seen = new Set<string>();
  for (const { to } of out) {
    if (seen.has(to.toLowerCase()))
      throw new Error(`Two files would both be named ${to}.`);
    seen.add(to.toLowerCase());
  }
  return out;
}
