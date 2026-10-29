import path from "node:path";
import { app, shell, type Session } from "electron";
import { DownloadManager } from "./manager.ts";
import { BrowserLink } from "./link.ts";

// One download manager for Yami: the Downloads page, the Yami Browser and
// the browser extension all hand links to it. Built when first used.

let manager: DownloadManager | undefined;
let config: { dataDir: string; broadcast: (event: any) => void } | undefined;

let link: BrowserLink | undefined;

export function initDownloads(c: NonNullable<typeof config>) {
  config = c;
  void browserLink().resume();
}

/** The Yami Home extension's link to this download manager. */
export function browserLink() {
  if (!config) throw new Error("Downloads are not ready yet.");
  link ||= new BrowserLink(
    config.dataDir,
    app.isPackaged
      ? path.join(process.resourcesPath, "extension")
      : path.join(app.getAppPath(), "extension"),
    (url, name) => {
      downloads().add(url, { name });
      config?.broadcast({
        type: "toast",
        message: "A download from your browser is in Yami.",
      });
    },
  );
  return link;
}

export function downloads() {
  if (!config) throw new Error("Downloads are not ready yet.");
  manager ||= new DownloadManager(
    path.join(config.dataDir, "downloads.json"),
    app.getPath("downloads"),
    (jobs) => config?.broadcast({ type: "downloads", jobs }),
  );
  return manager;
}

/** The Yami Browser's downloads go to Yami's manager, with its cookies. */
export function catchDownloads(profile: Session) {
  profile.on("will-download", (event, item) => {
    const url = item.getURL();
    if (!/^https?:/i.test(url)) return; // blob: and data: stay with Chromium
    event.preventDefault();
    downloads().add(url, {
      name: item.getFilename(),
      fetcher: (u, init) => profile.fetch(u, init as any),
    });
    config?.broadcast({
      type: "toast",
      message: `Downloading ${item.getFilename()} in Yami.`,
    });
  });
}

/** Requests from pages under downloads.*. */
export async function downloadsRequest(method: string, a: any = {}) {
  const m = downloads();
  if (method === "downloads") return m.list();
  if (method === "downloads.add") {
    m.add(a.url);
    return m.list();
  }
  if (method === "downloads.pause") return m.pause(a.id);
  if (method === "downloads.resume") return m.resume(a.id);
  if (method === "downloads.remove")
    return m.remove(a.id, a.deleteFile === true);
  if (method === "downloads.clear") return m.clearFinished();
  if (method === "downloads.settings") return m.set(a);
  if (method === "downloads.open" || method === "downloads.reveal") {
    const job = m.list().jobs.find((j) => j.id === a.id);
    if (!job?.file) throw new Error("That download has not finished.");
    if (method === "downloads.reveal") shell.showItemInFolder(job.file);
    else {
      const error = await shell.openPath(job.file);
      if (error) throw new Error(error);
    }
    return true;
  }
  if (method === "downloads.link") return browserLink().status();
  if (method === "downloads.link.set") return browserLink().set(a.on);
  if (method === "downloads.link.prepare") return browserLink().prepare();
  if (method === "downloads.link.open")
    return browserLink().openBrowser(a.browser);
  if (method === "downloads.link.folder") {
    await shell.openPath(browserLink().folder());
    return true;
  }
  if (method === "downloads.folder") {
    await shell.openPath(m.settings.folder);
    return true;
  }
  throw new Error("Unknown downloads request.");
}
