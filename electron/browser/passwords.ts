import { randomUUID } from "node:crypto";

// Saved logins for the Yami Browser, from a CSV the user exported from
// another browser or password manager. Yami never reads other browsers'
// encrypted password stores. Logins live inside the vault (DPAPI) and are
// only ever filled into a page when the user picks one.

export type Login = {
  id: string;
  /** scheme://host[:port] the login belongs to. */
  origin: string;
  username: string;
  password: string;
  name: string;
};

/** RFC 4180 rows: quoted fields may hold commas, quotes ("") and newlines. */
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export function originOf(url: string) {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.origin : "";
  } catch {
    return "";
  }
}

/**
 * Logins from an exported CSV. Chrome and Edge use name,url,username,
 * password; Firefox url,username,password; Bitwarden login_uri,
 * login_username, login_password.
 */
export function readLoginCsv(text: string): Login[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) throw new Error("That file is empty.");
  const col = (...names: string[]) =>
    head.findIndex((h) => names.includes(h.trim().toLowerCase()));
  const url = col("url", "login_uri", "origin", "website"),
    user = col("username", "login_username", "user", "email"),
    pass = col("password", "login_password"),
    name = col("name", "title");
  if (url < 0 || pass < 0)
    throw new Error(
      "This does not look like an exported password file (it needs url and password columns).",
    );
  const out: Login[] = [];
  for (const r of rows.slice(0, 10000)) {
    const origin = originOf(r[url] || "");
    const password = r[pass] || "";
    if (!origin || !password) continue;
    out.push({
      id: randomUUID(),
      origin,
      username: (user >= 0 ? r[user] : "") || "",
      password,
      name: (name >= 0 ? r[name] : "") || new URL(origin).hostname,
    });
  }
  return out;
}

/** Adds logins, replacing an older one for the same site and username. */
export function mergeLogins(saved: Login[], incoming: Login[]) {
  const key = (l: Login) => `${l.origin}\n${l.username}`;
  const map = new Map(saved.map((l) => [key(l), l]));
  let added = 0;
  for (const l of incoming) {
    if (!map.has(key(l))) added++;
    map.set(key(l), { ...l, id: map.get(key(l))?.id || l.id });
  }
  return { logins: [...map.values()].slice(0, 10000), added };
}

/** The script that fills a login into the page's own fields. */
export function fillScript(username: string, password: string) {
  return `(() => {
    const visible = (el) => el && !el.disabled && el.offsetParent !== null;
    const set = (el, value) => {
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter ? setter.call(el, value) : (el.value = value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const pass = [...document.querySelectorAll('input[type="password"]')].find(visible);
    if (!pass) return { filled: false };
    const inputs = [...(pass.form || document).querySelectorAll("input")].filter(visible);
    const before = inputs.slice(0, inputs.indexOf(pass)).reverse();
    const user = before.find((el) => /^(text|email|tel)$/i.test(el.type || "text"));
    if (user && ${JSON.stringify(username)}) set(user, ${JSON.stringify(username)});
    set(pass, ${JSON.stringify(password)});
    return { filled: true };
  })()`;
}
