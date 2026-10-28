import test from "node:test";
import assert from "node:assert/strict";
import { convertUnits } from "../src/units.ts";
import { paletteItems } from "../src/palette.ts";
import { defaults } from "../src/default-settings.ts";

test("unit conversions read naturally and refuse mixed kinds", () => {
  assert.equal(convertUnits("5 km to mi").text, "3.10686 mi");
  assert.equal(convertUnits("72 f in c").text, "22.2222 °C");
  assert.equal(convertUnits("0 c to k").text, "273.15 K");
  assert.equal(convertUnits("2 gb mb").text, "2000 MB");
  assert.equal(convertUnits("3 cups in ml").text, "709.765 ml");
  assert.equal(convertUnits("90 min to h").text, "1.5 h");
  assert.equal(convertUnits("100 km/h to mph").text, "62.1371 mph");
  assert.equal(convertUnits("1,5 kg to lb").text, "3.30693 lb");
  assert.equal(convertUnits("5 km to kg"), undefined);
  assert.equal(convertUnits("hello world"), undefined);
  assert.equal(convertUnits("2+2"), undefined);
});

test("the palette offers conversions, addresses, bangs, agents and a web search", () => {
  const settings = {
    ...defaults,
    workbenchEnabled: true,
    browserEnabled: true,
  };
  const first = (q, ...rest) => paletteItems(q, settings, ...rest)[0];
  assert.equal(first("5 km to mi").run.copy, "3.10686 mi");
  assert.deepEqual(first("github.com/xtermjs").run, {
    method: "browser.show",
    args: { url: "https://github.com/xtermjs" },
  });
  assert.match(first("!w Kyoto").run.args.url, /wikipedia\.org.*Kyoto/);
  const projects = [{ id: "p1", name: "yami", path: "D:\\code\\yami" }];
  assert.deepEqual(first("claude yami", projects, ["claude"]).run, {
    method: "dev.launch",
    args: { project: "p1", agent: "claude" },
  });
  assert.notEqual(
    first("aider yami", projects, ["claude"])?.id,
    "agent:aider:p1",
    "only installed agents",
  );
  const search = first("best ramen near shibuya");
  assert.equal(search.id, "search");
  assert.equal(
    paletteItems("best ramen", { ...settings, browserEnabled: false })[0].run
      .method,
    "open.external",
  );
});
