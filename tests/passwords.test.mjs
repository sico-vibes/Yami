import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  mergeLogins,
  parseCsv,
  readLoginCsv,
} from "../electron/browser/passwords.ts";
import { Vault } from "../electron/browser/vault.ts";

test("exported password files from Chrome, Firefox and Bitwarden read the same", () => {
  assert.deepEqual(parseCsv('a,"b, ""c""",d\r\n"multi\nline",x,\n'), [
    ["a", 'b, "c"', "d"],
    ["multi\nline", "x", ""],
  ]);
  const chrome = readLoginCsv(
    "name,url,username,password,note\nshop,https://shop.example/login,ana,s3cret,\nlocal,chrome://x,a,b,\nempty,https://e.example,a,,\n",
  );
  assert.deepEqual(
    chrome.map(({ origin, username, password, name }) => [
      origin,
      username,
      password,
      name,
    ]),
    [["https://shop.example", "ana", "s3cret", "shop"]],
  );
  const firefox = readLoginCsv(
    '"url","username","password","httpRealm"\n"https://mail.example:8443","ana@x","p,w",""\n',
  );
  assert.equal(firefox[0].origin, "https://mail.example:8443");
  assert.equal(firefox[0].password, "p,w");
  const bitwarden = readLoginCsv(
    "﻿folder,favorite,type,name,login_uri,login_username,login_password\n,,login,Git,https://git.example/,dev,tok\n",
  );
  assert.deepEqual(
    [bitwarden[0].origin, bitwarden[0].username],
    ["https://git.example", "dev"],
  );
  assert.throws(() => readLoginCsv("title,notes\nx,y\n"), /url and password/);
  const merged = mergeLogins(
    chrome,
    readLoginCsv("url,username,password\nhttps://shop.example/,ana,newer\n"),
  );
  assert.equal(
    merged.added,
    0,
    "same site and username is replaced, not added",
  );
  assert.equal(merged.logins[0].password, "newer");
  assert.equal(merged.logins[0].id, chrome[0].id);
});

test("the vault keeps logins encrypted and lists a site's logins without passwords", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-pw-"));
  const crypto = {
    encrypt: (t) => Buffer.from("enc:" + Buffer.from(t).toString("base64")),
    decrypt: (b) => Buffer.from(b.toString().slice(4), "base64").toString(),
    available: () => true,
  };
  const vault = new Vault(path.join(dir, "vault.bin"), crypto);
  assert.deepEqual(
    vault.importLogins(
      "url,username,password\nhttps://shop.example,ana,s3cret\nhttps://shop.example,bo,x\n",
    ),
    { added: 2, total: 2 },
  );
  const forShop = vault.loginsFor("https://shop.example/account/login?next=1");
  assert.deepEqual(
    forShop.map((l) => l.username),
    ["ana", "bo"],
  );
  assert.ok(
    forShop.every((l) => !("password" in l)),
    "no passwords leave the vault",
  );
  assert.deepEqual(vault.loginsFor("https://evil.example/shop.example"), []);
  assert.equal(vault.login(forShop[0].id).password, "s3cret");
  assert.doesNotMatch(
    fs.readFileSync(path.join(dir, "vault.bin"), "utf8"),
    /s3cret/,
  );
  assert.equal(new Vault(path.join(dir, "vault.bin"), crypto).loginCount(), 2);
  assert.equal(vault.clearLogins(), 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
