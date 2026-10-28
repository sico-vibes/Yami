import { buildEngineFile } from "./filter-engine";

// Child process entry (dist-electron/filter-build.cjs, run by Electron as
// Node): builds the engine file away from the main process, then exits, so
// the memory the parse needed goes back to Windows.
const [lists, out] = JSON.parse(process.argv[2] || "[]");
buildEngineFile(lists, out).then(
  () => process.exit(0),
  (error: Error) => {
    process.stderr.write(error.message);
    process.exit(1);
  },
);
