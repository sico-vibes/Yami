import fs from "node:fs";
import { FiltersEngine } from "@ghostery/adblocker";

/** Parses the downloaded lists and writes the compact engine file. */
export async function buildEngineFile(lists: string[], out: string) {
  const text = (
    await Promise.all(lists.map((file) => fs.promises.readFile(file, "utf8")))
  ).join("\n");
  const engine = FiltersEngine.parse(text, {
    enableCompression: true,
    loadCosmeticFilters: true,
    // Procedural selectors need a script in every page; Yami only blocks
    // requests and hides elements with plain CSS.
    loadExtendedSelectors: false,
  });
  await fs.promises.writeFile(out, engine.serialize());
}
