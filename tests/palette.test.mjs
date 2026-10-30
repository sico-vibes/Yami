import test from "node:test";
import assert from "node:assert/strict";
import { calculate, formatResult } from "../src/calc.ts";
import { paletteItems } from "../src/palette.ts";
import { defaults } from "../src/default-settings.ts";

test("the launcher calculator parses sums without evaluating code", () => {
  assert.equal(calculate("2+3*4"), 14);
  assert.equal(calculate("= (2 + 3) * 4"), 20);
  assert.equal(calculate("2^3^2"), 512);
  assert.equal(calculate("-3 + 5"), 2);
  assert.equal(calculate("10 % 4"), 2);
  assert.equal(calculate("1,000 * 3"), 3000);
  assert.equal(calculate("7 × 6 ÷ 2"), 21);
  assert.equal(calculate("42"), undefined, "a number alone is not a sum");
  assert.equal(calculate("chrome"), undefined);
  assert.equal(calculate("2 +"), undefined);
  assert.equal(calculate("(1+2"), undefined);
  assert.equal(calculate("1/0"), undefined, "infinity is not shown");
  assert.equal(calculate("alert(1)+1"), undefined);
  assert.equal(formatResult(0.1 + 0.2), "0.3");
  assert.equal(formatResult(1234567.5), "1,234,567.5");
});

test("palette results follow the query and the modules that are on", () => {
  const settings = { ...defaults, tuneEnabled: false };
  assert.deepEqual(paletteItems("", settings), []);
  assert.equal(paletteItems("2*21", settings)[0].title, "= 42");
  assert.deepEqual(paletteItems("2*21", settings)[0].run, { copy: "42" });
  assert.ok(
    paletteItems("tweaks", settings).every((i) => i.id !== "page:tune"),
  );
  assert.equal(
    paletteItems("tweaks", { ...settings, tuneEnabled: true })[0].id,
    "page:tune",
  );
  assert.equal(paletteItems("modules", settings)[0].id, "page:settings");
  const projects = [{ id: "p1", name: "yami", path: "D:Codeyami" }];
  const found = paletteItems("yami", settings, projects);
  assert.deepEqual(found.find((i) => i.id === "project:p1").run, {
    method: "dev.launch",
    args: { project: "p1" },
  });
  // With the workspace off no project is offered (only a web search is).
  assert.deepEqual(
    paletteItems(
      "yami",
      { ...settings, workbenchEnabled: false },
      projects,
    ).map((i) => i.id),
    ["search"],
  );
});
