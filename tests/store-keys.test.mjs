import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
test("adding/removing workspace keys preserves prior credentials and chats; failed encryption is atomic", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-keys-"));
  globalThis.yamiKeyFixture = { dir, fail: false };
  try {
    // Deterministic encryption stub isolates storage behavior; Windows DPAPI runs in Electron.
    const compiled = await build({
      entryPoints: ["electron/store.ts"],
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      plugins: [
        {
          name: "fixture-electron",
          setup(b) {
            b.onResolve({ filter: /^electron$/ }, () => ({
              path: "electron",
              namespace: "fixture",
            }));
            b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
              contents: `export const app={getPath:()=>globalThis.yamiKeyFixture.dir}; export const safeStorage={isEncryptionAvailable:()=>!globalThis.yamiKeyFixture.fail,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()};`,
            }));
          },
        },
      ],
    });
    const { Store } = await import(
      "data:text/javascript;base64," +
        Buffer.from(compiled.outputFiles[0].text).toString("base64")
    );
    fs.writeFileSync(
      path.join(dir, "data.json"),
      JSON.stringify({
        messages: [{ id: "preserve", text: "Keep this conversation" }],
      }),
    );
    const store = new Store();
    store.setKeys({ gemini: "existing-fixture", tavily: "search-fixture" });
    store.setKeys({
      "provider:local": "local-fixture",
      "connection:fixture": "connection-fixture",
    });
    assert.equal(store.key("gemini"), "existing-fixture");
    assert.equal(store.key("tavily"), "search-fixture");
    const before = fs.readFileSync(store.secretsFile);
    globalThis.yamiKeyFixture.fail = true;
    assert.throws(
      () => store.setKeys({ gemini: "replacement", "provider:local": "" }),
      /unavailable/,
    );
    assert.deepEqual(fs.readFileSync(store.secretsFile), before);
    assert.equal(store.key("gemini"), "existing-fixture");
    globalThis.yamiKeyFixture.fail = false;
    store.setKeys({ "provider:local": "" });
    store.save();
    const restarted = new Store();
    assert.equal(restarted.key("gemini"), "existing-fixture");
    assert.equal(restarted.key("provider:local"), "");
    assert.equal(restarted.state.messages[0].text, "Keep this conversation");
    assert.ok(
      !JSON.stringify(restarted.publicState()).includes("existing-fixture"),
    );
  } finally {
    delete globalThis.yamiKeyFixture;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
