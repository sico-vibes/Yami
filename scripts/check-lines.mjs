import fs from "node:fs";
import path from "node:path";
const ignored = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-electron",
  "release",
  ".artifacts",
  ".firecrawl",
  ".impeccable",
  // Machine-generated; Dependabot writes it in npm's expanded format.
  "package-lock.json",
]);
const textTypes = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".cs",
  ".ps1",
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".html",
  ".txt",
  ".svg",
  ".xml",
]);
let count = 0;
const failures = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(e.name) || e.isSymbolicLink()) continue;
    const file = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (file === path.join("native", "bin")) continue;
      walk(file);
      continue;
    }
    if (
      !textTypes.has(path.extname(file)) &&
      !["LICENSE", "AGENTS.md"].includes(e.name)
    )
      continue;
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0);
    count++;
    if (lines > 1000) failures.push(`${file}: ${lines} lines`);
  }
}
walk(".");
if (failures.length) {
  console.error("Split these files before committing:\n" + failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(`PASS: ${count} project text files are at most 1,000 lines.`);
