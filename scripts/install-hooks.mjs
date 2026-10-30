// npm install (prepare) points git at .githooks so the pre-push checks run.
// Does nothing outside a git checkout, for example in an installed copy.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

if (fs.existsSync(".git"))
  try {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"]);
    console.log("Git hooks: .githooks (pre-push runs npm run verify).");
  } catch {}
