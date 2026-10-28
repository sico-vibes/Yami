import fs from "node:fs";
import path from "node:path";

// Checks other than first-run setup start past "Choose your Yami". Leaves an
// existing test profile alone; the app migrates it on load.
export function skipSetup(dir) {
  const file = path.join(dir, "data.json");
  if (fs.existsSync(file)) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ settings: { setupDone: true } }));
}
