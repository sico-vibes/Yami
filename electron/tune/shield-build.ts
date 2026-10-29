import { packList } from "./shield-lists";

// Child process entry (dist-electron/shield-build.cjs, run by Electron as
// Node): parses one downloaded block list into the name files the shield
// searches, then exits, so the memory the parse needed goes back to Windows.
const [source, format, base] = JSON.parse(process.argv[2] || "[]");
packList(source, format, base).then(
  (counts) => {
    process.stdout.write(JSON.stringify(counts));
    process.exit(0);
  },
  (error: Error) => {
    process.stderr.write(error.message);
    process.exit(1);
  },
);
