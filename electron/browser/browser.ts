import {
  session,
  WebContentsView,
  type BrowserWindow,
  type Session,
} from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { newTab, resolveInput, webOnly } from "../../src/browser-rules.ts";
import { isBlockedHost } from "../../src/blocklist.ts";
import {
  pageNamesScript,
  type FilterLists,
  type PageNames,
} from "./filter-lists.ts";
import {
  pageScript,
  riskyAction,
  uploadScript,
  type Found,
  type Target,
} from "../../src/browser-agent.ts";

export type BrowserTab = {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  canBack: boolean;
  canForward: boolean;
  /** Freed after a few idle minutes in the background; reloads on return. */
  discarded: boolean;
};

const maxTabs = 12;
const discardAfter = Number(process.env.YAMI_TAB_DISCARD_MS) || 5 * 60_000;

/**
 * The Yami Browser: Electron's own Chromium in one window, with a separate
 * profile that stays in Yami's data folder. Pages get no Node access, no
 * device permissions, and only http(s) navigation.
 */
export function createBrowser(deps: {
  /** Read on every request, so the switch applies at once. */
  blocking: () => boolean;
  /** EasyList and EasyPrivacy, once the user has downloaded them. */
  filters?: FilterLists;
  makeWindow: (
    mode: string,
    options: Electron.BrowserWindowConstructorOptions,
  ) => BrowserWindow;
}) {
  let win: BrowserWindow | undefined;
  let profile: Session | undefined;
  const tabs: (BrowserTab & {
    view?: WebContentsView;
    timer?: NodeJS.Timeout;
  })[] = [];
  let active = "";
  let bounds = { x: 0, y: 0, width: 0, height: 0 };
  let driving = "";
  let blocked = 0;
  const history: { url: string; title: string; at: number }[] = [];

  const publish = () =>
    win?.webContents.send("yami:event", {
      type: "browser-state",
      tabs: tabs.map(({ view: _v, timer: _t, ...t }) => t),
      active,
      driving,
      blocked,
    });
  const ownSession = () => {
    if (profile) return profile;
    profile = session.fromPartition("persist:yami-browser");
    profile.setPermissionRequestHandler((_wc, _permission, done) =>
      done(false),
    );
    profile.setPermissionCheckHandler(() => false);
    // Known ad and tracker hosts never get a request.
    profile.webRequest.onBeforeRequest((details, done) => {
      let host = "";
      try {
        host = new URL(details.url).hostname;
      } catch {}
      const cancel =
        deps.blocking() &&
        !!host &&
        (isBlockedHost(host) || !!deps.filters?.blocks(details));
      if (cancel) blocked++;
      done({ cancel });
    });
    return profile;
  };
  const tab = (id: string) => tabs.find((t) => t.id === id);
  const place = () => {
    for (const t of tabs) {
      if (!t.view) continue;
      t.view.setVisible(t.id === active && t.url !== newTab);
      if (t.id === active) t.view.setBounds(bounds);
    }
  };
  const sync = (t: (typeof tabs)[number]) => {
    const wc = t.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    t.url = wc.getURL() || t.url;
    t.title = wc.getTitle() || t.title;
    t.loading = wc.isLoading();
    t.canBack = wc.navigationHistory.canGoBack();
    t.canForward = wc.navigationHistory.canGoForward();
    // A finished page joins the recent list (newest first, no repeats).
    if (!t.loading && webOnly(t.url) && t.title && history[0]?.url !== t.url) {
      history.unshift({ url: t.url, title: t.title, at: Date.now() });
      for (let i = history.length - 1; i > 0; i--)
        if (history.findIndex((h) => h.url === history[i].url) < i)
          history.splice(i, 1);
      history.length = Math.min(history.length, 200);
    }
    publish();
  };
  const wake = (t: (typeof tabs)[number]) => {
    clearTimeout(t.timer);
    if (t.view || t.url === newTab || !win) return;
    const view = new WebContentsView({
      webPreferences: {
        session: ownSession(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    });
    t.view = view;
    t.discarded = false;
    win.contentView.addChildView(view);
    const wc = view.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      if (webOnly(url)) api.open(url);
      return { action: "deny" };
    });
    wc.on("will-navigate", (e, url) => {
      if (!webOnly(url)) e.preventDefault();
    });
    wc.on("will-redirect", (e, url) => {
      if (!webOnly(url)) e.preventDefault();
    });
    // Hide ad slots the lists name, with plain CSS (no page scripts).
    wc.on("dom-ready", async () => {
      const filters = deps.filters;
      if (!deps.blocking() || !filters?.active) return;
      // World 998 is Yami's own; the page cannot see or change the result.
      const names: PageNames | undefined = await wc
        .executeJavaScriptInIsolatedWorld(998, [{ code: pageNamesScript }])
        .catch(() => undefined);
      if (wc.isDestroyed()) return;
      const css = filters.hidingCss(wc.getURL(), names);
      if (css) void wc.insertCSS(css, { cssOrigin: "user" }).catch(() => {});
    });
    for (const event of [
      "did-start-loading",
      "did-stop-loading",
      "page-title-updated",
      "did-navigate",
      "did-navigate-in-page",
    ] as const)
      wc.on(event as any, () => sync(t));
    void wc.loadURL(t.url).catch(() => {});
    place();
  };
  // A hidden tab's page is closed after a while; its address is kept.
  const sleepLater = (t: (typeof tabs)[number]) => {
    clearTimeout(t.timer);
    if (!t.view) return;
    t.timer = setTimeout(() => {
      if (t.id === active || !t.view) return;
      win?.contentView.removeChildView(t.view);
      t.view.webContents.close();
      t.view = undefined;
      t.discarded = true;
      publish();
    }, discardAfter);
  };

  const api = {
    show() {
      // Loads saved lists into memory and refreshes a week-old copy.
      void deps.filters?.get();
      deps.filters?.refreshIfStale();
      if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
        return;
      }
      win = deps.makeWindow("browser", {
        width: 1240,
        height: 820,
        minWidth: 760,
        minHeight: 520,
        backgroundColor: "#11191e",
      });
      win.once("ready-to-show", () => win?.show());
      win.on("closed", () => {
        for (const t of tabs) clearTimeout(t.timer);
        tabs.length = 0;
        win = undefined;
        active = "";
      });
      if (!tabs.length) api.open(newTab);
    },
    open(input: string) {
      if (tabs.length >= maxTabs)
        throw new Error(`Close a tab first (up to ${maxTabs}).`);
      const url = input === newTab ? newTab : resolveInput(input);
      const t = {
        id: randomUUID(),
        url,
        title: url === newTab ? "New tab" : url,
        loading: false,
        canBack: false,
        canForward: false,
        discarded: false,
      };
      tabs.push(t);
      api.select(t.id);
      return t.id;
    },
    select(id: string) {
      const t = tab(id);
      if (!t) throw new Error("That tab is closed.");
      const previous = tab(active);
      active = id;
      if (previous && previous.id !== id) sleepLater(previous);
      wake(t);
      place();
      publish();
    },
    navigate(id: string, input: string) {
      const t = tab(id);
      if (!t) throw new Error("That tab is closed.");
      t.url = resolveInput(input);
      if (t.url === newTab) {
        if (t.view) {
          win?.contentView.removeChildView(t.view);
          t.view.webContents.close();
          t.view = undefined;
        }
        t.title = "New tab";
      } else if (t.view) void t.view.webContents.loadURL(t.url).catch(() => {});
      else wake(t);
      place();
      publish();
    },
    go(id: string, step: "back" | "forward" | "reload" | "stop") {
      const wc = tab(id)?.view?.webContents;
      if (!wc) return;
      if (step === "back") wc.navigationHistory.goBack();
      else if (step === "forward") wc.navigationHistory.goForward();
      else if (step === "reload") wc.reload();
      else wc.stop();
    },
    close(id: string) {
      const i = tabs.findIndex((t) => t.id === id);
      if (i < 0) return;
      const [t] = tabs.splice(i, 1);
      clearTimeout(t.timer);
      if (t.view) {
        win?.contentView.removeChildView(t.view);
        t.view.webContents.close();
      }
      if (active === id) {
        const next = tabs[Math.min(i, tabs.length - 1)];
        if (next) api.select(next.id);
        else {
          active = "";
          api.open(newTab);
        }
      }
      publish();
    },
    layout(rect: { x: number; y: number; width: number; height: number }) {
      bounds = {
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      };
      place();
    },
    state() {
      return {
        tabs: tabs.map(({ view: _v, timer: _t, ...t }) => t),
        active,
        driving,
        blocked,
      };
    },
    history: () => history.slice(0, 30),
    clearHistory() {
      history.length = 0;
      return true;
    },
    /** The current page's main article as plain paragraphs, for reading. */
    async reader() {
      const wc = tab(active)?.view?.webContents;
      if (!wc) throw new Error("Open a page first.");
      const text = String(
        await wc.executeJavaScript(
          "(() => { const root = document.querySelector('article') || document.querySelector('main') || document.body; return root ? root.innerText : ''; })()",
          false,
        ),
      );
      return {
        title: wc.getTitle(),
        url: wc.getURL(),
        text: text.slice(0, 200000),
      };
    },
    /**
     * For agents: click or type on the active page. Risky actions (submit,
     * pay, post, delete) wait for `ask`; password fields are refused.
     */
    async act(
      kind: "click" | "type" | "select",
      target: Target,
      text: string,
      ask: (title: string, detail: string) => Promise<boolean>,
    ) {
      const wc = tab(active)?.view?.webContents;
      if (!wc) throw new Error("Open a page in the Yami Browser first.");
      if (!target.selector && !target.text)
        throw new Error("Say what to click or type into.");
      const run = (act: "find" | "click" | "type" | "select") =>
        wc.executeJavaScriptInIsolatedWorld(999, [
          { code: pageScript(target, kind, act, text) },
        ]) as Promise<Found>;
      driving =
        kind === "click"
          ? "An agent is clicking on this page"
          : kind === "select"
            ? "An agent is choosing from a menu on this page"
            : "An agent is typing on this page";
      publish();
      try {
        const found = await run("find");
        if (!found?.found) throw new Error("Nothing on the page matches that.");
        if (found.password)
          throw new Error("Agents cannot type into password fields.");
        if (kind === "select" && !found.chosen)
          return {
            done: false,
            label: found.label || "",
            options: found.options || [],
            url: wc.getURL(),
          };
        if (riskyAction(found)) {
          const ok = await ask(
            kind === "select"
              ? `Let an agent choose “${found.chosen}” in “${found.label || "a menu"}”?`
              : `Let an agent ${kind === "click" ? "press" : "type into"} “${found.label || found.tag}”?`,
            `On ${wc.getURL()}${kind === "type" ? `\nText: ${text.slice(0, 300)}` : ""}`,
          );
          if (!ok) throw new Error("The user said no.");
        }
        const done = await run(kind);
        return {
          done: !!done?.found && (kind !== "select" || !!done.chosen),
          label: done?.label || "",
          ...(kind === "select" && { chosen: done?.chosen || "" }),
          url: wc.getURL(),
        };
      } finally {
        driving = "";
        publish();
      }
    },
    /** For agents: the active page's title, address and visible text. */
    async read(max = 20000) {
      const t = tab(active);
      const wc = t?.view?.webContents;
      if (!t || !wc)
        return { title: t?.title || "", url: t?.url || "", text: "" };
      driving = "Reading this page for an agent";
      publish();
      try {
        const text = String(
          await wc.executeJavaScript(
            "document.body ? document.body.innerText : ''",
            false,
          ),
        );
        return {
          title: wc.getTitle(),
          url: wc.getURL(),
          text: text.slice(0, max),
        };
      } finally {
        driving = "";
        publish();
      }
    },
    /**
     * For agents: attach one local file to a file field on the active page.
     * It always asks the user first, naming the file and the site.
     */
    async upload(
      target: Target,
      file: string,
      ask: (title: string, detail: string) => Promise<boolean>,
    ) {
      const wc = tab(active)?.view?.webContents;
      if (!wc) throw new Error("Open a page in the Yami Browser first.");
      const full = path.resolve(file);
      let size = 0;
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile()) throw new Error();
        size = stat.size;
      } catch {
        throw new Error("That file is not on this PC.");
      }
      if (size > 100 * 1024 * 1024)
        throw new Error("Files over 100 MB are not uploaded by agents.");
      const token = randomUUID();
      const found = (await wc.executeJavaScriptInIsolatedWorld(999, [
        { code: uploadScript(target, token) },
      ])) as Found & { count?: number };
      if (!found?.found)
        throw new Error(
          found?.count
            ? "Say which file field: this page has more than one."
            : "This page has no file field.",
        );
      driving = "An agent wants to upload a file";
      publish();
      try {
        const ok = await ask(
          `Let an agent upload “${path.basename(full)}”?`,
          `To ${new URL(wc.getURL()).host}${found.label ? ` (${found.label})` : ""}\nFile: ${full}\nSize: ${Math.ceil(size / 1024)} KB`,
        );
        if (!ok) throw new Error("The user said no.");
        const cdp = wc.debugger;
        const attached = cdp.isAttached();
        if (!attached) cdp.attach("1.3");
        try {
          const { root } = await cdp.sendCommand("DOM.getDocument", {
            depth: 0,
          });
          const { nodeId } = await cdp.sendCommand("DOM.querySelector", {
            nodeId: root.nodeId,
            selector: `[data-yami-upload="${token}"]`,
          });
          if (!nodeId) throw new Error("The file field went away.");
          await cdp.sendCommand("DOM.setFileInputFiles", {
            nodeId,
            files: [full],
          });
        } finally {
          if (!attached) cdp.detach();
        }
        return { done: true, file: path.basename(full), url: wc.getURL() };
      } finally {
        void wc
          .executeJavaScriptInIsolatedWorld(999, [
            {
              code: `document.querySelector('[data-yami-upload="${token}"]')?.removeAttribute("data-yami-upload")`,
            },
          ])
          .catch(() => {});
        driving = "";
        publish();
      }
    },
    /**
     * Fills a login into the active page, only while that page is on the
     * login's own site. World 997 is Yami's; the page sees only the values.
     */
    async fill(origin: string, script: string) {
      const wc = tab(active)?.view?.webContents;
      if (!wc) throw new Error("Open the sign-in page first.");
      let here = "";
      try {
        here = new URL(wc.getURL()).origin;
      } catch {}
      if (here !== origin) throw new Error("That login is for another site.");
      const result = await wc.executeJavaScriptInIsolatedWorld(997, [
        { code: script },
      ]);
      if (!result?.filled)
        throw new Error("No password field is showing on this page.");
      return true;
    },
    owns(sender: Electron.WebContents) {
      return !!win && !win.isDestroyed() && win.webContents.id === sender.id;
    },
    dispose() {
      if (win && !win.isDestroyed()) win.close();
    },
  };
  return api;
}
