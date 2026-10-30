# Yami Browser

Yami Browser is a light web browser inside Yami. It has tabs, an address bar that understands shortcuts, a vault for your bookmarks, built-in blocking of ads and trackers, and a reader for articles.

It is a separate browser profile. It does not share cookies or logins with Chrome, Edge or other browsers on your PC.

Turn it on in **Settings > Modules > Yami Browser**, or choose the Everything preset. Then type "browser" in the launcher (**Win + A**) to open it.

## Browse

- **Tabs:** the tab rail on the side lists your tabs. Open up to 12 tabs.
- **Links that open a new window** open a new tab instead.
- **Navigation:** back, forward, reload, and the address bar.
- **Address bar:** type a web address, a search, or a shortcut (a "bang"), such as `!w Kyoto`. The shortcuts are `!g` (Google), `!ddg` (DuckDuckGo), `!b` (Bing), `!w` (Wikipedia), `!yt` (YouTube), `!gh` (GitHub), `!npm` (npm), `!r` (Reddit) and `!mdn` (MDN).
- **Sleeping tabs:** a tab you leave in the background for five minutes is put to sleep to free memory. It reloads when you return to it.

Only `http` and `https` pages open. Other addresses such as `file:` become searches.

Pages cannot reach your camera, microphone, location or notifications. Those requests are refused.

## Vault and bookmarks

The **Vault** keeps your bookmarks, encrypted with Windows.

- **Import** bookmarks from Chrome, Edge, Brave, Vivaldi or Helium on this PC.
- The new-tab page lists and filters your bookmarks.
- **Import from another browser** also reads history from Chrome, Edge, Brave, Vivaldi, Helium and Firefox. Yami keeps the newest 2,000 pages, merged without repeats, under **From your other browsers**. It never reads passwords or cookies from those browsers.

Yami copies each browser's database to a temporary file and reads the copy, so the other browser can stay open. The copy is deleted straight away.

## Saved logins

You can use the logins you already have in a password manager.

1. Export your passwords as a CSV file from Chrome, Edge, Firefox or Bitwarden.
2. On the new-tab page, press **Import a passwords file**.
3. Yami encrypts the logins in the vault. It then offers to delete the exported file, because that file holds passwords in plain text.

On a page with a saved login, a key button appears in the toolbar. Press it to fill in the username and password. Nothing fills in on its own. A login is never filled on a different site. The page list shows names only.

## Blocking ads and trackers

- **Built-in list.** About 35 well-known ad and tracker domains are blocked before they load. The shield button in the toolbar shows how many were blocked and turns blocking on or off.
- **Full filter lists.** On the new-tab page, press **Download filter lists** to get EasyList and EasyPrivacy from easylist.to (about 3.4 MB). With the shield on, they block ad and tracker requests and hide ad boxes. They refresh when you open the browser if the copy is more than a week old.
- **Update now** and **Remove lists** are on the same card.

Blocking never blocks the page you open yourself.

## Reader

The book button shows the main text of an article as clean paragraphs, in Yami's style. The page steps aside while the reader is open.

## Recent pages

Pages you finish are listed on the new-tab page, up to 200 for the current session. The list is not saved to disk. **Clear** empties it.

## Linked browser

Some sites, including Google and many banks, refuse to sign in inside embedded browsers. For those, the new-tab page can open your installed Microsoft Edge, Google Chrome, Brave or Helium instead.

- The window uses its own Yami profile folder, never your usual profile.
- Closing it from Yami ends it.
- **Note:** while that window is open, the browser listens on `127.0.0.1:47824`. Any program on this PC can talk to that port, so close the window when you are done.

## Agents and the browser

When **Yami for your agents** is on, agents can use these browser tools. Each one is off until you turn it on:

- **Open and read:** open an address and read its title, address and visible text.
- **Click:** press a link or button by its visible text.
- **Type:** fill in a field, without submitting the form.
- **Select:** choose an option in a drop-down menu.
- **Upload:** attach one file from your PC to a file field. Yami always asks you first, naming the file and the site.

While an agent works, a bar at the top says what it is doing. A click that submits a form, or that looks like it buys, pays, orders, posts, sends, deletes or subscribes, waits for your approval. Password fields are never typed into.

## What it needs

- The **Yami Browser** module.
- An internet connection.
- A Chromium-based browser, if you use the linked browser for sign-ins.

## Privacy

Browsing data, bookmarks and the vault stay on this PC. The filter lists come from easylist.to only when you ask for them. Yami does not read passwords or cookies from other browsers. See [providers and privacy](../providers-and-privacy.md).
