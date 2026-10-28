// Nightglow guard. Shipped screens use Yami's Select, data-tip tooltips and
// Modal dialogs, and colours come from tokens.css. Older files still carry raw
// colours, so those counts are a ratchet: they may fall, never rise.
// Run with --update to lower the ratchet after a cleanup.
import fs from "node:fs";
import path from "node:path";

const baselineFile = path.join("scripts", "ui-baseline.json");
const update = process.argv.includes("--update");
const baseline = fs.existsSync(baselineFile)
  ? JSON.parse(fs.readFileSync(baselineFile, "utf8"))
  : {};
// Canvas and character art draw literal colours on purpose.
const rawColourAllowed = new Set([
  "src/styles/tokens.css",
  "src/wheel/paint.ts",
  "src/yami/skins.ts",
  "src/yami/features.ts",
  "src/yami/YamiSpirit.tsx",
]);
// A synchronous navigation guard cannot await a dialog.
const confirmAllowed = new Set(["src/workbench/Notes.tsx"]);
// Counts `title=` on lowercase JSX elements. Attribute values can hold `=>`
// and nested tags, so the scan tracks braces instead of stopping at `>`.
function titleAttributes(text) {
  let hits = 0;
  for (const start of text.matchAll(/<[a-z][\w-]*[\s>]/g)) {
    let depth = 0;
    for (let i = start.index + start[0].length - 1; i < text.length; i++) {
      const c = text[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (depth === 0 && c === ">") break;
      else if (depth === 0 && /\stitle=/.test(text.slice(i - 1, i + 6)) && c === "t") {
        hits++;
        break;
      }
    }
  }
  return hits;
}
const rules = [
  { name: "native <select>", count: (t) => t.match(/<select[\s>]/g)?.length || 0, ext: [".tsx"] },
  { name: "title tooltip", count: titleAttributes, ext: [".tsx"] },
  {
    name: "window.confirm",
    count: (t) => t.match(/window\.confirm\(/g)?.length || 0,
    ext: [".tsx", ".ts"],
    allow: confirmAllowed,
  },
];
const colour = /#[0-9a-fA-F]{3,8}\b|rgba?\(/g;

function walk(dir, found = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "preview") walk(file, found);
    } else if (/\.(tsx?|css)$/.test(e.name)) found.push(file.split(path.sep).join("/"));
  }
  return found;
}

const failures = [];
const counts = {};
for (const file of walk("src")) {
  const text = fs.readFileSync(file, "utf8");
  const ext = path.extname(file);
  for (const rule of rules) {
    if (!rule.ext.includes(ext) || rule.allow?.has(file)) continue;
    const hits = rule.count(text);
    if (hits) failures.push(`${file}: ${hits} × ${rule.name}`);
  }
  if (rawColourAllowed.has(file)) continue;
  const hits = text.match(colour)?.length || 0;
  if (hits) counts[file] = hits;
  if (!update && hits > (baseline[file] || 0))
    failures.push(
      `${file}: ${hits} raw colours (allowed ${baseline[file] || 0}). Use a token from src/styles/tokens.css.`,
    );
}
if (update) {
  fs.writeFileSync(baselineFile, JSON.stringify(counts, null, 2) + "\n");
  console.log(`Updated ${baselineFile}.`);
} else if (failures.length) {
  console.error("Nightglow check failed:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
} else console.log("Nightglow check passed.");
