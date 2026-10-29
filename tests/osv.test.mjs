import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkProject, lockPackages } from "../electron/workbench/osv.ts";

test("lockfiles give each installed name and version once", () => {
  assert.deepEqual(
    lockPackages({
      lockfileVersion: 3,
      packages: {
        "": { name: "app", version: "1.0.0" },
        "node_modules/lodash": { version: "4.17.20" },
        "node_modules/@scope/pkg": { version: "2.0.0" },
        "node_modules/a/node_modules/lodash": { version: "4.17.20" },
        "node_modules/linked": { link: true, version: "1.0.0" },
        "node_modules/odd": { version: "git+https://x" },
      },
    }),
    [
      { name: "lodash", version: "4.17.20" },
      { name: "@scope/pkg", version: "2.0.0" },
    ],
  );
  assert.deepEqual(
    lockPackages({
      lockfileVersion: 1,
      dependencies: {
        a: { version: "1.0.0", dependencies: { b: { version: "2.1.0" } } },
      },
    }),
    [
      { name: "a", version: "1.0.0" },
      { name: "b", version: "2.1.0" },
    ],
  );
});

test("a project is checked in one batch and advisories get a summary", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-osv-"));
  await assert.rejects(checkProject(dir), /no package-lock/);
  fs.writeFileSync(
    path.join(dir, "package-lock.json"),
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "node_modules/lodash": { version: "4.17.20" },
        "node_modules/ok": { version: "1.0.0" },
      },
    }),
  );
  const sent = [];
  const r = await checkProject(dir, async (url, init) => {
    sent.push([String(url), init?.body ? JSON.parse(init.body) : null]);
    if (String(url).endsWith("querybatch"))
      return new Response(
        JSON.stringify({ results: [{ vulns: [{ id: "GHSA-1" }] }, {}] }),
      );
    return new Response(
      JSON.stringify({ id: "GHSA-1", summary: "Prototype pollution\nmore" }),
    );
  });
  assert.equal(r.packages, 2);
  assert.deepEqual(r.findings, [
    { name: "lodash", version: "4.17.20", ids: ["GHSA-1"] },
  ]);
  assert.deepEqual(r.details, { "GHSA-1": "Prototype pollution" });
  assert.deepEqual(sent[0][1].queries[0], {
    package: { name: "lodash", ecosystem: "npm" },
    version: "4.17.20",
  });
  assert.equal(sent[1][0], "https://api.osv.dev/v1/vulns/GHSA-1");
  fs.rmSync(dir, { recursive: true, force: true });
});
