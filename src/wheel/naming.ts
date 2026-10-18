import path from "node:path";

const COMPOUNDS = [".tar.gz", ".tar.bz2", ".tar.xz"];

export function stemOf(name: string) {
  const lower = name.toLowerCase();
  const compound = COMPOUNDS.find((ext) => lower.endsWith(ext));
  if (compound) return name.slice(0, -compound.length);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function allocateFile(
  directory: string,
  base: string,
  extension: string,
  exists: (value: string) => boolean,
) {
  const ext = extension.replace(/^\./, "");
  const first = path.join(directory, `${base}.${ext}`);
  if (!exists(first)) return first;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(directory, `${base} ${index}.${ext}`);
    if (!exists(candidate)) return candidate;
  }
  throw new Error("Too many files already use that name.");
}

export function allocateFolder(
  directory: string,
  base: string,
  exists: (value: string) => boolean,
) {
  const first = path.join(directory, base);
  if (!exists(first)) return first;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(directory, `${base} ${index}`);
    if (!exists(candidate)) return candidate;
  }
  throw new Error("Too many folders already use that name.");
}

export function conversionBase(name: string) {
  return stemOf(name);
}

export function toolBase(name: string, suffix: string) {
  return `${stemOf(name)} ${suffix}`;
}
