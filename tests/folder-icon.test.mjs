import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  iconIni,
  resetFolderIcon,
  setFolderIcon,
} from "../electron/wheel/folder-icon.ts";

const attrs = (p) =>
  execFileSync("attrib.exe", [p], { encoding: "utf8" }).slice(0, 12);

test("folder icons write a hidden desktop.ini and reset cleanly", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yami-icon-"));
  const folder = path.join(root, "photos");
  fs.mkdirSync(folder);
  const icon = path.join(root, "star.ico");
  fs.writeFileSync(icon, "icon");
  await assert.rejects(
    setFolderIcon(folder, path.join(root, "a.png")),
    /\.ico/,
  );
  await setFolderIcon(folder, icon);
  const ini = path.join(folder, "desktop.ini");
  assert.equal(fs.readFileSync(ini, "utf8"), iconIni(icon));
  assert.match(attrs(ini), /S.*H|H.*S/);
  assert.match(attrs(folder), /R/);
  // Setting again replaces Yami's own file.
  await setFolderIcon(folder, icon);
  assert.equal(await resetFolderIcon(folder), true);
  assert.ok(!fs.existsSync(ini));
  assert.doesNotMatch(attrs(folder), /R/);
  assert.equal(await resetFolderIcon(folder), false);
  // Someone else's desktop.ini is left alone.
  fs.writeFileSync(ini, "[.ShellClassInfo]\r\nIconResource=x.ico,0\r\n");
  await assert.rejects(setFolderIcon(folder, icon), /leaves it alone/);
  await assert.rejects(resetFolderIcon(folder), /not set by Yami/);
  assert.match(fs.readFileSync(ini, "utf8"), /x\.ico/);
  fs.rmSync(root, { recursive: true, force: true });
});
