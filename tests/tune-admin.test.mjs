import test from "node:test";
import assert from "node:assert/strict";
import { adminElevatedArgs, adminServices } from "../electron/tune/admin.ts";

test("the administrator helper is started with only fixed words", () => {
  assert.deepEqual([...adminServices], ["DiagTrack", "MapsBroker"]);
  const args = adminElevatedArgs("D:\\Basem's\\Admin.ps1", [
    "-Mode",
    "service",
    "-Name",
    "DiagTrack",
    "-Start",
    "Disabled",
  ]);
  assert.equal(args[2], "-Command");
  assert.match(args[3], /-Verb RunAs -Wait -PassThru/);
  assert.ok(args[3].includes("'\"D:\\Basem''s\\Admin.ps1\"'"), args[3]);
  assert.ok(
    args[3].includes("'-Name','DiagTrack','-Start','Disabled'"),
    args[3],
  );
});
