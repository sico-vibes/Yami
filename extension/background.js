// Yami Home's background: "Download with Yami" on links, and, when chosen,
// every download handed to Yami's download manager instead of the
// browser's. It talks only to Yami on this PC (127.0.0.1), with the key Yami
// wrote into this folder when it prepared the extension.

const YAMI = "http://127.0.0.1:47823";

async function key() {
  try {
    const r = await fetch(chrome.runtime.getURL("yami-link.json"));
    return (await r.json()).token || "";
  } catch {
    return "";
  }
}

async function send(url, filename) {
  const token = await key();
  if (!token) return false;
  try {
    const r = await fetch(`${YAMI}/download`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, filename }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "yami-download",
    title: "Download with Yami",
    contexts: ["link", "image", "video", "audio"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const url = info.linkUrl || info.srcUrl;
  if (url && /^https?:/i.test(url)) void send(url);
});

// When "Send all downloads to Yami" is on, the browser's download is
// cancelled only after Yami has taken it; if Yami is not running, the
// browser keeps it.
chrome.downloads.onCreated.addListener(async (item) => {
  const { sendAll } = await chrome.storage.local.get("sendAll");
  if (!sendAll || !/^https?:/i.test(item.finalUrl || item.url)) return;
  if (await send(item.finalUrl || item.url, item.filename)) {
    chrome.downloads.cancel(item.id);
    chrome.downloads.erase({ id: item.id });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type === "yami-status") {
    key().then(async (token) => {
      if (!token) return reply({ linked: false });
      try {
        const r = await fetch(`${YAMI}/ping`, { headers: { authorization: `Bearer ${token}` } });
        reply({ linked: r.ok });
      } catch {
        reply({ linked: false });
      }
    });
    return true;
  }
});
