// Desktop check for PDF text on the file wheel, in the source or packaged
// app: makes a two-page PDF, drops it on the shelf and converts it to text
// with the "to:txt" petal, which reads it with pdf.js. The packaged run
// proves pdf.js loads from outside the app archive. Isolated profile.
// Usage: node scripts/verify-wheel-pdf.mjs [--packaged]
import { _electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { skipSetup } from "./test-profile.mjs";

const packaged = process.argv.includes("--packaged");
const profile = path.resolve(`.artifacts/wheel-pdf-${Date.now()}`);
skipSetup(profile);
const work = path.join(profile, "work");
fs.mkdirSync(work, { recursive: true });
const pdf = path.join(work, "letter.pdf");
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
doc.addPage().drawText("Dear Yami,", { x: 50, y: 700, font, size: 18 });
doc
  .addPage()
  .drawText("Page two says hello.", { x: 50, y: 700, font, size: 18 });
fs.writeFileSync(pdf, await doc.save());

const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch(
  packaged
    ? {
        executablePath: path.resolve("release/win-unpacked/Yami.exe"),
        env,
        args: [],
      }
    : { args: [path.resolve(".")], env },
);
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await new Promise((r) => setTimeout(r, 100));
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  await call("wheel.shelf.drop", { paths: [pdf] });
  const session = await call("wheel.session");
  assert.equal(session.files[0].name, "letter.pdf");
  const result = await call("wheel.choose", { petalId: "to:txt" });
  const out = result.outputs?.[0];
  assert.ok(
    out && fs.existsSync(out),
    `a text file was written: ${JSON.stringify(result)}`,
  );
  const text = fs.readFileSync(out, "utf8");
  assert.match(text, /Dear Yami,/);
  assert.match(text, /Page two says hello\./);
  console.log(
    JSON.stringify({ passed: true, packaged, output: path.basename(out) }),
  );
} finally {
  await app.close();
}
