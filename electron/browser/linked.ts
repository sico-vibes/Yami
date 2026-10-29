import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Linked browser mode: an installed Chromium browser started with its own
// Yami profile folder and a debugging port on loopback, so sign-ins that
// refuse embedded browsers (Google, banks) work, and Yami's agent tools can
// still read the page. The user's normal browser profile is never used.

export type LinkedBrowser = { id: string; name: string; exe: string };

export function linkedBrowsers(
  env: NodeJS.ProcessEnv = process.env,
): LinkedBrowser[] {
  const pf = env.ProgramFiles || "C:\\Program Files";
  const pf86 = env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = env.LOCALAPPDATA || "";
  const candidates: [string, string, string[]][] = [
    [
      "edge",
      "Microsoft Edge",
      [
        path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
      ],
    ],
    [
      "chrome",
      "Google Chrome",
      [
        path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
      ],
    ],
    [
      "brave",
      "Brave",
      [
        path.join(
          pf,
          "BraveSoftware",
          "Brave-Browser",
          "Application",
          "brave.exe",
        ),
        path.join(
          local,
          "BraveSoftware",
          "Brave-Browser",
          "Application",
          "brave.exe",
        ),
      ],
    ],
    [
      "helium",
      "Helium",
      [path.join(local, "imput", "Helium", "Application", "helium.exe")],
    ],
  ];
  return candidates.flatMap(([id, name, paths]) => {
    const exe = paths.find((p) => fs.existsSync(p));
    return exe ? [{ id, name, exe }] : [];
  });
}

/** Arguments: a separate profile, loopback-only debugging, a first page. */
export function linkedArgs(
  profile: string,
  port: number,
  url: string,
  headless = false,
  /** Yami Home, loaded into this Yami-only profile when the link is on. */
  extension?: string,
) {
  return [
    ...(extension ? [`--load-extension=${extension}`] : []),
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    "--no-first-run",
    "--no-default-browser-check",
    ...(headless ? ["--headless=new"] : []),
    url,
  ];
}

/** One Chrome DevTools Protocol command over the page's WebSocket. */
async function cdp(wsUrl: string, method: string, params: object, ms = 10000) {
  return new Promise<any>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("The linked browser did not answer."));
    }, ms);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(String(e.data));
      if (msg.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Yami could not reach the linked browser."));
    };
  });
}

export function createLinked(deps: {
  profileRoot: string;
  port?: number;
  /** The prepared Yami Home folder, or undefined when the link is off. */
  extension?: () => string | undefined;
}) {
  const port = deps.port ?? 47824;
  let child: ChildProcess | undefined;
  let current: LinkedBrowser | undefined;
  const pages = async () => {
    const r = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(3000),
    });
    const list = (await r.json()) as {
      type: string;
      url: string;
      title: string;
      webSocketDebuggerUrl: string;
    }[];
    return list.filter((p) => p.type === "page");
  };
  return {
    list: () => linkedBrowsers(),
    running: () => !!child && child.exitCode === null,
    current: () => current,
    async open(id: string, url: string, headless = false) {
      const browser = linkedBrowsers().find((b) => b.id === id);
      if (!browser) throw new Error("That browser is not installed.");
      if (child && child.exitCode === null) {
        await fetch(`http://127.0.0.1:${port}/json/new?${encodeURI(url)}`, {
          method: "PUT",
        }).catch(() => {});
        return true;
      }
      const profile = path.join(deps.profileRoot, "linked-" + browser.id);
      fs.mkdirSync(profile, { recursive: true });
      child = spawn(
        browser.exe,
        linkedArgs(profile, port, url, headless, deps.extension?.()),
        {
          detached: false,
          stdio: "ignore",
          windowsHide: headless,
        },
      );
      current = browser;
      child.once("exit", () => {
        child = undefined;
        current = undefined;
      });
      // Wait until its debugging endpoint answers.
      for (let i = 0; i < 50; i++) {
        try {
          await pages();
          return true;
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      throw new Error(
        `${browser.name} started but did not open its debugging port.`,
      );
    },
    /** The front page's title, address and visible text. */
    async read(max = 20000) {
      const [page] = await pages().catch(() => []);
      if (!page) throw new Error("No linked browser page is open.");
      const r = await cdp(page.webSocketDebuggerUrl, "Runtime.evaluate", {
        expression: "document.body ? document.body.innerText : ''",
        returnByValue: true,
      });
      return {
        title: page.title,
        url: page.url,
        text: String(r?.result?.value || "").slice(0, max),
      };
    },
    close() {
      if (child && child.exitCode === null) child.kill();
      child = undefined;
      current = undefined;
    },
  };
}
