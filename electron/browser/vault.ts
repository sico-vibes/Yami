import fs from "node:fs";
import path from "node:path";
import { webOnly } from "../../src/browser-rules.ts";
import {
  firefoxPlaces,
  readChromiumHistory,
  readFirefoxPlaces,
  type Visit,
} from "./history-import.ts";
import {
  mergeLogins,
  originOf,
  readLoginCsv,
  type Login,
} from "./passwords.ts";

export type Bookmark = {
  title: string;
  url: string;
  folder: string;
  from: string;
};

/** Chromium-family browsers whose Bookmarks and History Yami can import. */
export function browserProfiles(local: string) {
  const at = (...parts: string[]) =>
    path.join(local, ...parts, "User Data", "Default", "Bookmarks");
  return [
    { id: "chrome", name: "Google Chrome", file: at("Google", "Chrome") },
    { id: "edge", name: "Microsoft Edge", file: at("Microsoft", "Edge") },
    { id: "brave", name: "Brave", file: at("BraveSoftware", "Brave-Browser") },
    { id: "vivaldi", name: "Vivaldi", file: at("Vivaldi") },
    { id: "helium", name: "Helium", file: at("imput", "Helium") },
  ].map((b) => ({ ...b, history: path.join(path.dirname(b.file), "History") }));
}

/** Every http(s) bookmark in a Chromium Bookmarks file, with its folder. */
export function readChromiumBookmarks(json: string, from: string): Bookmark[] {
  const data = JSON.parse(json);
  const out: Bookmark[] = [];
  const walk = (node: any, folder: string, depth: number) => {
    if (!node || depth > 30 || out.length >= 5000) return;
    if (
      node.type === "url" &&
      typeof node.url === "string" &&
      webOnly(node.url)
    )
      out.push({
        title: String(node.name || node.url).slice(0, 300),
        url: node.url,
        folder,
        from,
      });
    if (Array.isArray(node.children))
      for (const child of node.children)
        walk(
          child,
          node.type === "folder" && depth > 0
            ? (folder ? folder + " › " : "") + String(node.name || "")
            : folder,
          depth + 1,
        );
  };
  for (const root of Object.values(data.roots || {})) walk(root, "", 0);
  return out;
}

type Crypto = {
  encrypt: (text: string) => Buffer;
  decrypt: (data: Buffer) => string;
  available: () => boolean;
};

/**
 * Bookmarks kept for the Yami Browser, encrypted as a whole with Windows'
 * DPAPI (Electron safeStorage). Yami imports only plain Bookmarks files; it
 * never decrypts other browsers' passwords or cookies.
 */
export class Vault {
  private bookmarks: Bookmark[] = [];
  private visits: Visit[] = [];
  private logins: Login[] = [];
  constructor(
    private file: string,
    private crypto: Crypto,
  ) {
    try {
      const saved = JSON.parse(crypto.decrypt(fs.readFileSync(file)));
      this.bookmarks = saved.bookmarks || [];
      this.visits = saved.history || [];
      this.logins = saved.logins || [];
    } catch {}
  }
  list() {
    return this.bookmarks;
  }
  history() {
    return this.visits;
  }
  /** Logins from an exported CSV's text; the file itself is not kept. */
  importLogins(csv: string) {
    const { logins, added } = mergeLogins(this.logins, readLoginCsv(csv));
    this.logins = logins;
    this.save();
    return { added, total: this.logins.length };
  }
  loginCount() {
    return this.logins.length;
  }
  /** What the toolbar may show for a page: names only, never passwords. */
  loginsFor(url: string) {
    const origin = originOf(url);
    return this.logins
      .filter((l) => origin && l.origin === origin)
      .map(({ id, username, name }) => ({ id, username, name }));
  }
  /** One login, for filling; stays in the main process. */
  login(id: string) {
    return this.logins.find((l) => l.id === id);
  }
  clearLogins() {
    this.logins = [];
    this.save();
    return 0;
  }
  sources(local: string, roaming = "") {
    const firefox = roaming ? firefoxPlaces(roaming) : "";
    return [
      ...browserProfiles(local).map((b) => ({
        id: b.id,
        name: b.name,
        found: fs.existsSync(b.file) || fs.existsSync(b.history),
      })),
      {
        id: "firefox",
        name: "Firefox",
        found: !!firefox && fs.existsSync(firefox),
      },
    ];
  }
  /** Bookmarks and history from another browser, merged without repeats. */
  import(id: string, local: string, roaming = "") {
    let bookmarks: Bookmark[] = [],
      visits: Visit[] = [];
    if (id === "firefox") {
      const file = roaming ? firefoxPlaces(roaming) : "";
      if (!file) throw new Error("Firefox has no profile on this PC.");
      ({ bookmarks, visits } = readFirefoxPlaces(file));
    } else {
      const browser = browserProfiles(local).find((b) => b.id === id);
      if (!browser) throw new Error("Choose a browser.");
      if (fs.existsSync(browser.file))
        bookmarks = readChromiumBookmarks(
          fs.readFileSync(browser.file, "utf8"),
          browser.name,
        );
      if (fs.existsSync(browser.history))
        visits = readChromiumHistory(browser.history, browser.name);
      if (!bookmarks.length && !visits.length)
        throw new Error(
          `${browser.name} has no bookmarks or history on this PC.`,
        );
    }
    const known = new Set(this.bookmarks.map((b) => b.url));
    const added = bookmarks.filter(
      (b) => !known.has(b.url) && known.add(b.url),
    );
    this.bookmarks = [...this.bookmarks, ...added].slice(0, 5000);
    const seen = new Map(this.visits.map((v) => [v.url, v]));
    for (const v of visits)
      if ((seen.get(v.url)?.at || 0) < v.at) seen.set(v.url, v);
    this.visits = [...seen.values()].sort((a, b) => b.at - a.at).slice(0, 2000);
    this.save();
    return {
      added: added.length,
      total: this.bookmarks.length,
      history: visits.length,
    };
  }
  remove(url: string) {
    this.bookmarks = this.bookmarks.filter((b) => b.url !== url);
    this.save();
    return this.bookmarks;
  }
  clearHistory() {
    this.visits = [];
    this.save();
    return this.visits;
  }
  clear() {
    this.bookmarks = [];
    this.visits = [];
    this.logins = [];
    fs.rmSync(this.file, { force: true });
    return this.bookmarks;
  }
  private save() {
    if (!this.crypto.available())
      throw new Error(
        "Windows credential encryption is unavailable, so the vault was not saved.",
      );
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = this.file + ".tmp";
    fs.writeFileSync(
      temp,
      this.crypto.encrypt(
        JSON.stringify({
          bookmarks: this.bookmarks,
          history: this.visits,
          logins: this.logins,
        }),
      ),
    );
    fs.renameSync(temp, this.file);
  }
}
