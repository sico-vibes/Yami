// Writes public/spirit.svg (Yami at rest, default skin) from the same shapes
// the app renders. Run before `node scripts/create-icon.mjs`.
// Usage: node --experimental-transform-types scripts/export-spirit.mjs
import fs from "node:fs";
import { LAYER_COUNT, layerPath } from "../src/yami/motion.ts";
import { BLUSH, EARS, EYES, MOUTH, WHISKERS } from "../src/yami/features.ts";
import { skins } from "../src/yami/skins.ts";
const s = skins.yami,
  layers = Array.from({ length: LAYER_COUNT }, (_, i) => layerPath(i, 0, 0));
const ellipse = (e, extra = "") =>
  `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}"${extra}/>`;
const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 4 110 110">`,
  `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter></defs>`,
  `<path d="${layers[0]}" fill="${s.glow}" opacity=".45" filter="url(#g)"/>`,
  ...EARS.map(
    (e) =>
      `<path d="${e.outer}" fill="${s.flame[0]}"/><path d="${e.inner}" fill="${s.flame[1]}"/>`,
  ),
  ...layers.map((d, i) => `<path d="${d}" fill="${s.flame[i]}"/>`),
  `<g fill="${s.glow}" opacity=".35">${BLUSH.map((b) => ellipse(b)).join("")}</g>`,
  `<g fill="none" stroke="${s.line}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">`,
  `<path d="${WHISKERS}" opacity=".55"/><path d="${MOUTH}"/></g>`,
  `<g fill="${s.eye}">${EYES.map((e) => ellipse(e)).join("")}</g>`,
  `</svg>`,
].join("");
fs.writeFileSync("public/spirit.svg", svg + "\n");
console.log("Wrote public/spirit.svg");
