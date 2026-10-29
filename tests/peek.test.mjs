import test from "node:test";
import assert from "node:assert/strict";
import { peekKind, textPage } from "../electron/peek-kinds.ts";

test("quick look knows which files it can show, and shows text as text", () => {
  assert.equal(peekKind("C:/a/photo.JPG"), "image");
  assert.equal(peekKind("report.pdf"), "pdf");
  assert.equal(peekKind("song.flac"), "media");
  assert.equal(peekKind("index.html"), "text", "HTML is shown, never run");
  assert.equal(peekKind(".gitignore"), "text");
  assert.equal(peekKind("setup.exe"), undefined);
  const page = textPage("a<b>.html", "<script>alert(1)</script> & done", true);
  assert.ok(page.includes("&lt;script&gt;alert(1)&lt;/script&gt; &amp; done"));
  assert.ok(page.includes("<title>a&lt;b&gt;.html</title>"));
  assert.ok(!page.includes("<script>"));
  assert.ok(page.includes("Showing the first 512 KB."));
});
