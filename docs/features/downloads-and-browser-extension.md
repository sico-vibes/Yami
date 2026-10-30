# Downloads and the browser extension

Yami has its own download manager. It can split large files into parts and download them at the same time. Yami Home is a browser extension that sends downloads and links to Yami.

## Download manager

Open **Desk > Downloads**.

### Start a download

- **Paste a link** into the box and start it.
- **Download in Yami Browser.** Downloads started in the Yami Browser come to this list, with the browser's cookies, so logged-in downloads work.
- **Use the browser extension.** See below.

Only `http` and `https` links are accepted. Links with a username or password in them are refused.

### What you see

Each download shows its progress, speed, time left and parts. You can:

- **Pause** and **Resume**.
- **Open** a finished file.
- **Show in Explorer** to find it.
- **Remove** a download. A finished file stays on disk.

### How it works

- When the server allows it, a file of a few megabytes or more is split into up to eight parts, downloaded together, and put back in order. The default is four parts. Change this with the **connections** menu.
- Up to three files download at a time. The rest wait.
- Files go to your Downloads folder. Yami never overwrites a file. A new file named `file.zip` becomes `file (2).zip`.
- While a download is unfinished, its file has a `.yamipart` ending.
- Paused and unfinished downloads are kept in `downloads.json`. After a restart they come back paused, and they resume from where each part stopped.

## Yami Home (browser extension)

Yami Home is a small extension for Chrome, Edge and Brave. It does three things:

- It replaces your new tab page with the time, a greeting, a search box, a background picture and your bookmark tiles.
- It adds **Download with Yami** to the right-click menu on links. You can also turn on **Send all downloads to Yami**.
- It keeps your tiles, folders and background in the browser's own extension storage.

The extension talks only to Yami, on this PC. Yami only accepts "download this link" requests from it. Yami's link server runs only while you have **Link browsers to Yami** turned on, in Desk > Downloads.

### Install it

Browsers only add extensions from their own store or with **Load unpacked**. Yami prepares the files, so you only need a few clicks:

1. Open **Desk > Downloads** and turn on **Link browsers to Yami**.
2. Press **Install in** and your browser's name (Edge, Chrome or Brave, whichever Yami found). Yami prepares the extension folder, copies its path and opens your browser's extensions page.
3. Turn on **Developer mode**.
4. Select **Load unpacked**, paste the folder path, and select the folder.

### Linked browser window

When you open a linked browser window from Yami Browser, Microsoft Edge loads Yami Home by itself while **Link browsers to Yami** is on. Chrome does not, so use the steps above there.

## Settings that affect it

- **Link browsers to Yami** (Desk > Downloads): starts or stops the link server.
- **Send all downloads to Yami**: in the Customize panel on Yami Home's new tab page. When it is on, a browser download goes to Yami once Yami has taken it.
- **Settings > Modules > Yami Browser**: turn on the built-in browser, if you want its downloads in Yami.

## What it needs

- Nothing extra for the download manager, beyond an internet connection.
- A supported browser for the extension: Chrome, Edge or Brave.

## Privacy

Downloads are fetched directly from the site you choose. The extension sends only the link you asked to download to Yami on this PC. Yami does not send your browsing to any server of its own. See [providers and privacy](../providers-and-privacy.md).
