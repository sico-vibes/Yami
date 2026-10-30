# Utilities

Yami includes a set of small Windows tools. Most live in the island drawer's **Controls** and **Today** tabs, and in the launcher (**Win + A**).

## Keep awake

Keeps your PC from sleeping for a set time.

1. Open the **Controls** tab.
2. Under **Keep awake**, choose whether to keep the screen on too.
3. Pick a length: 30 minutes, 1 hour, 2 hours or 4 hours, or leave it on until you turn it off.

The island and every Yami window show the same state. Quitting Yami ends it.

## Colour picker

1. In the **Controls** tab, press **Pick a colour**. The drawer closes.
2. Move the pointer over the screen. A magnifier shows the pixels around it and the colour code.
3. Click to copy the colour as `#rrggbb`. It is also saved to your last 12 colours, which you can copy again from the swatches. **Clear** empties them.

Press **Esc** or right-click to cancel. The picker works from a still picture of the screen, so moving content is picked as it was when you started.

## Always on top

In the **Controls** tab, press **Keep ... on top**. The last window you used, other than Yami's, stays above other windows. On Windows 11 it also gets a lavender border. Press again to unpin.

Some windows cannot be pinned. These include games in exclusive full screen, and admin-run apps when Yami is not running as an administrator.

## Window layouts

Move the last window you used to a set place on its screen.

- In the **Controls** tab, press **Arrange**, then choose a half, quarter, third, two thirds, the centre, or maximised.
- Or type in the launcher, such as `snap left`, `snap top right`, `arrange centre` or `snap maximised`.

Windows stay inside their work area, so the taskbar stays clear.

## Workspaces

A workspace remembers which windows are open and where.

1. Arrange your windows the way you like.
2. In the **Controls** tab, press **Save open windows**. Yami saves up to 30 windows, with their programs, positions and sizes, in up to 10 workspaces.
3. Later, press **Restore**. Yami moves windows that are open to their saved places and starts apps that are closed. It then tells you how many it moved, started and could not restore.

Windows on other virtual desktops are not saved. Explorer folder windows and Settings are moved when open, but are not started again.

## Quick look

Preview a file without opening it.

1. Turn on **Quick look** in **Settings > Shortcuts**.
2. In a File Explorer folder window, select a file and press **Ctrl + Space**.
3. Press **Ctrl + Space** again or **Esc** to close the preview.

Pictures, PDFs, video and sound use the standard viewers. Text and code files, including HTML, show as plain text, up to 512 KB. Scripts in HTML and SVG files do not run in the preview.

## Launcher

Press **Win + A** to search apps, files, snippets and Yami's own pages. The launcher also does these things:

- **Sums:** type `12*7+0.5` to see the result. Press Enter to copy it.
- **Units:** `5 km to mi`, `72 f in c`, `2 gb to mb`, `3 cups in ml`, `90 min to h`, `100 km/h to mph`. Press Enter to copy the answer.
- **Currency:** `100 usd to eur`, `$20 in egp`, `1,250 gbp into jpy`. The first result is the converted amount with the rate's date. Press Enter to copy it. Rates are daily reference rates, not live market prices.
- **Web:** a web address, such as `github.com/xtermjs`, opens at once. A shortcut such as `!w Kyoto` searches Wikipedia. Other searches go to the web.
- **Agents:** an agent name followed by a project, such as `claude yami`, starts that agent in a terminal in the project.
- **Files:** Yami searches its file index, and then Windows Search, for files in your user folder.

## Today

The **Today** tab in the island drawer holds:

- **Clock and week.** Days with scheduled plans have a dot.
- **Weather.** Press **Turn on weather** on the card. It shows the forecast, plus UV and air quality for your location.
- **Public holidays.** Press **Show public holidays** under the week to mark holidays from Windows' region setting.
- **Focus timer.** Choose 1, 5, 10, 15 or 30 minutes. The timer runs in Yami and shows a Windows notification when it finishes, even if the drawer is closed.
- **Focus sessions.** Under the timer, **Keep awake** keeps your PC awake for the session. **Radio** plays one of your starred stations. **Block sites** blocks the sites you list (YouTube, Reddit, X, Instagram and TikTok by default) when Tune's network shield is running. When the timer ends, Yami undoes only what the session started.
- **To-dos.** Add to-dos and check them off.

Weather and holidays are off until you turn them on. Weather uses the city you enter in **Settings > Yami**, or an approximate location from your internet address if you leave it empty. Holidays use Windows' region setting.

## Daily brief

The Home screen shows up to four lines about your day when no conversation is open: plans left today and the next one, a public holiday, unread mail, and the newest feed headline. A line opens the page it came from.

## Light and dark on a schedule

In **Settings > System**, turn on **Light and dark on a schedule** to switch Windows between light and dark mode at set times. The defaults are 19:00 for dark and 07:00 for light. A night schedule, with dark during the day, also works. A manual change stays until the next switch.

## Wallpaper rotation

In the **Wallpaper** tab, choose a folder of images, then turn on rotation to change the desktop wallpaper every hour or every day, in order. Rotation needs at least two pictures.

## What it needs

- Keep awake, colour picker, always on top, layouts and workspaces, and the launcher's sums and units need nothing extra.
- Currency and holidays need an internet connection.
- Weather needs an internet connection and the Weather module.
- Window layouts and workspaces may not move windows that belong to administrator-run apps when Yami is not running as an administrator.

## Privacy

Most utilities work only on your PC. Weather, air quality, holidays and currency rates go to the services listed in [providers and privacy](../providers-and-privacy.md). Yami sends the currency codes, never the amount.
