# Features and settings

This guide describes features currently represented in the source. Hardware-dependent behavior can be unavailable, and provider-backed features depend on the connected account. An idea absent from this page may be planned; see [Roadmap](roadmap.md).

## Companion and conversation

**Yami, the cat spirit.** Yami is a floating, armless spirit with cat ears and a round, front-facing face whose lower half burns downward as a layered flame: a pale outer flame, a lighter middle and a white-hot core (`src/yami/`). While she is hovered, listening, thinking, speaking or being carried, the flame tongues flicker and curl, embers drift off and fade, and a soft glow under her shows she is floating. Afterwards she settles to a still pose and stops requesting animation frames. Turn on **Living flame** to keep a gentle flicker at idle. Reduced motion shows static poses.

**Spirit island.** A small top-center transparent island shows Yami and her listening/thinking/speaking state. Click anywhere on the notch (or scroll down on it) to open the drawer, double-click to open the full app, and right-click to arm an equipped ability. After about eight quiet seconds the notch slims to a thin bar and Yami tucks away; hovering it, a voice turn or any activity brings her back. Opening the drawer grows it out of the notch and hides Yami; closing plays the reverse. Messages that do not fit the collapsed island, such as a missing API key, appear in the caption pill at the bottom of the screen. While Yami runs a tool, a small card under the island names the action (for example "Opening Spotify"). When media is playing, hovering the small now-playing pill grows it into a card with progress and previous/play/next controls. Hovering the island otherwise hints that scrolling opens more. Scrolling down on the island opens the drawer; scrolling up at the top of the drawer tucks it away. It remains in the Windows tray when the main window is closed. Quit Yami from the tray to stop background work.

**Roaming.** With **Let Yami roam** on (Settings > Behavior, or the tray menu), Yami floats in a small click-through window on the desktop. She dodges the cursor twice with a quip, then lets you catch her: click opens Yami, drag moves her. She drifts to a nearby spot every few minutes (skipped on battery or while a fullscreen app is in front), hides while a fullscreen game, video or presentation is in front, naps after a minute alone, and flies into the island during voice and dictation turns. The tray checkbox follows the Settings toggle.

**Captions.** During a voice or dictation turn a pill at the bottom of the screen shows the held shortcut keys, your live transcript (`You`), then Yami's reply (`Yami`). The caption window exists only for the turn and closes a few seconds after it ends.

**Text chat.** Home sends text to Gemini’s text model. Up to the latest eight messages are included in the system prompt and up to 16 messages are used to construct request history. The turn can invoke declared tools, with a maximum of eight tool-call rounds. If no Gemini key is configured, chat is unavailable while local utilities remain available.

**Live voice.** Hold the voice shortcut or press the island ability button, speak, then release to finish. Voice connects through the Gemini Live API and streams audio. Yami uses explicit speech activity start/end boundaries; it does not send continuously when idle. A voice turn can make the same declared tool calls as text chat. A lasso selection with Gemini connected starts a one-shot voice question about the selected image.

**Dictation.** Hold the dictation shortcut. Yami remembers the foreground window handle, captures speech, asks Gemini to transcribe and resolve spoken corrections, then inserts the final text into that original field using clipboard-preserving paste. Password fields are rejected by the native host. Dictation text is also retained in conversation history. The engine is chosen in AI > Dictation: Gemini (the default); an installed Windows speech recognizer; or **Whistle offline**, Cactus Compute's 16.9 MB Whistle model run by its 1.6 MB Needle engine on this PC's processor (English, German, French, Spanish, Italian, Dutch and Polish). Both offline engines transcribe 16 kHz mono WAV locally and need no key. Choosing Whistle turns on the Offline dictation module and downloads its two pinned files; dictionary rules still apply afterwards. Whistle is **not verified on Windows yet**: its runner flags and output follow the published documentation, and keyword biasing and forcing a language are not passed because the runner documents no flag for them.

**Circle to ask.** Hold the lasso shortcut, draw a loop around anything on screen, and complete the selection. Capture occurs locally. With Gemini connected, the selected image can be sent with a voice turn; without a key, the image appears in the console selection. Cancel with Escape.

**Embers, skins, voices, personalities, and abilities.** The loadout presents cosmetic options and unlock prices for Yami. The current implementation awards an ember per completed voice turn or dictation. Soul, voice, personality, and ability choices are saved locally; they do not represent provider billing or a verified recreation of an original reward system. Paid voice cards use Gemini prebuilt voices and delivery prompts; they are not separately trained voices. The custom personality editor appears after that option is owned.

| Slot | Shipped choices and ember costs |
| --- | --- |
| Skin | Yami free; Ember 160; Wisp 160; Amethyst 400; Gilded 400; Void 1,000. Each is the same cat spirit with its own flame colours. Saved `hitodama` selections from earlier builds migrate to `yami` on start. |
| Voice | Charon free; Puck, Leda, Aoede, Enceladus, Algenib, Laomedeia, Jack, Ankit, Cheng, and Linda cost 240 each. Several named personas map to Gemini prebuilt voices plus delivery instructions. |
| Personality | Alley Cat free; New/custom personality 100. |
| Ability | Collapse is included with Void; Sidearm costs 400. The ability is armed by tapping the island and triggered by its configured mouse or keyboard binding. |

The visible price/catalogue system is a local product feature, not a provider subscription or proof of the original application’s unlock economics.

When an ability is equipped, the loadout’s **Trigger button** row captures a keyboard key or one of the primary mouse buttons. Escape cancels capture. Right-click Yami in the island while idle to arm the ability (a notice confirms it); the next captured trigger fires it and disarms it.

## Research and action tools

With Tavily connected, a quick search uses one basic search request. Deep research is opt-in per request, asks Gemini for two complementary queries, makes three advanced searches, and may extract source content for up to five results. Sources are shown with the answer. Actual credits are controlled by Tavily; the implementation’s expected count is detailed in [Security and provider data flow](security-and-providers.md). Without Tavily, search falls back to Wikipedia and returns up to five snippets.

Gemini can use the declared tool set described in [Architecture](architecture.md) and [Security and provider data flow](security-and-providers.md): launch a Windows app, open HTTP/HTTPS URL, open supported site search, inspect windows, focus/move/close a window, read accessible screen controls, activate an accessible control, click a raw coordinate, insert text, change volume/brightness/theme, control media, manage to-dos, schedule allowed work, save a memory, read/list files, write/move/recycle a file, or run PowerShell when enabled. Confirmations and restrictions are applied by the Electron main process.

## Productivity and organization

**Today.** A clock card, a weather card (its **Turn on weather** button enables weather right there), a week strip with dots on days that have scheduled plans (pick a day to list them), a focus timer, and the to-do list. The focus timer offers 1, 5, 10, 15 and 30 minute presets; the main process owns the countdown, so it finishes with a Windows notification even when the panel is closed.

**Plans.** Save a one-off or repeating reminder, app launch, URL open, site search, or routine of several app launches. Repeat options are once, daily, and weekly. Routines can have one to ten allowlisted actions. Yami checks due work while running, including while minimized to the tray, and checks missed work when it resumes. A waitable timer requests that Windows wake a sleeping PC for the next due time. This is subject to Windows policy, firmware, hardware, and session availability.

**Memory.** Create, edit, or delete explicit facts. Memory is local; when the memory setting is on, saved facts enter Gemini’s prompt. A user may turn memory off without deleting stored entries. The local-storage disclosure is centered beneath the memory list, including when empty.

**Main navigation.** Switching among Home, Bond, Soul, Desk, and Settings slides the dock's selected pill and briefly fades in the incoming page. Reduced motion, whether set in Yami or Windows, makes these changes immediate.

**Launcher.** `Win + A` searches installed apps, local files, and saved snippets. Favorite/recent apps are local. A chosen app launches through the Windows shell. Snippets can be stored, copied, and removed.

**Clipboard.** When enabled, Yami polls for text and keeps up to 500 entries. Choose a retention period of 1, 7, 14, or 30 days. Pinned entries do not expire automatically; they are stored unencrypted in `data.json`, while unpinned entries are encrypted. Copy, pin, delete, clear, and search history from the utility panel. Each entry is a card with its time and a pin button; pinned entries are listed first. See [security limitations](security-and-providers.md#practical-security-limits) before relying on exclusions.

## File wheel

Dragging a file and tapping a modifier can open a wheel of conversions, tools, or file actions at the pointer. The same wheel is available from an Explorer shortcut (`Ctrl+Alt+Y` by default), a Send to shortcut, and a tray drop shelf. The wheel window exists only while that gesture is open.

Dropping on a conversion petal saves a new file beside the original. Images, audio, and video need the matching engine. Documents, sheets, subtitles, and zip, tar, and gz archives convert inside Yami. Slides and page pictures need LibreOffice to already be installed. Compress, details, background, the image tools, the media tools, PDF merge, split, and organize open a small window. OCR is not connected. Copy path, move, the Windows clipboard copy, PowerShell, and the float shelf are on the actions wheel. Engines download on demand into local app data after a checksum check. See [File wheel](file-wheel.md) for which paths were executed, which are plans only, and what still has to be tried on Windows.

## Launcher (Win+A)

The Apps tab of the island drawer is also a small command palette. As you type, a **Yami** group appears above apps and files:
- **Sums** such as `12*7+0.5` or `=(2+3)^2`, using + − × ÷ % ^ and brackets. Press Enter to copy the result. The calculator parses the text itself; nothing is evaluated as code.
- **Pages:** Home, Bond, Soul, Desk, AI workspace, Tune, Settings and Choose features, matched by name or by words such as "modules", "tweaks" or "inbox".
- **Module actions:** the file wheel's drop shelf and Yami Terminal.
- **Projects** from the AI workspace, which open a terminal there. The list is read without loading the workspace.

Results follow your modules, so Tune and AI appear only while they are on. **Enter** opens the first result (a Yami item, else the first app, else the first file). Units, quicklinks, agents and Windows Search results from the plan are not built.

## Music and media

The Controls card and the island's media peek act on the playing app's own Windows media session: play and pause, previous and next, and, when the app offers them, **seek** (drag the progress line), **shuffle** and **repeat** (off, playlist, track) as two small toggles in the time row. The Spotify desktop app, browsers and most players expose this session, so it needs no Spotify account or API key. When a session refuses play, pause or skip, Yami falls back to the media keys. Seek, shuffle and repeat appear only when the player reports them. On 2026-10-28, `scripts/verify-media.mjs` checked play/pause, next and seek against a real Windows media session: a silent test page in the Yami Browser, acted on only while it was the current session. Shuffle and repeat were **not exercised**, because Chromium pages do not offer them to Windows; they need a player such as the Spotify app. **Lyrics** (off by default, Settings › Privacy) show the current line of a playing song in the island's media card, in the glow colour under the artist. Yami asks LRCLIB (lrclib.net), a free lyrics database with no key, once per track, sending only the artist, title and length; answers, including "no lyrics", are kept for the session. LRCLIB answered HTTP 503 during the 2026-10-28 check, so a live lookup is **not verified**; parsing and lookup are unit-tested. **Spotify (optional, Settings › Music)** adds what the Windows media session cannot: choosing which Spotify device plays (your phone, a speaker or this PC) and its volume, plus play and pause. You bring your own free Spotify developer app: create it, add the redirect URI `http://127.0.0.1:47823/callback`, add your account under User Management, and paste its Client ID. Yami signs in with PKCE, so no client secret exists. A one-off listener on `127.0.0.1:47823` takes the redirect for up to five minutes, and the refresh token is kept DPAPI-encrypted. Spotify requires Premium for these controls, and since February 2026 an app in development mode allows at most five users. Sign-in, token refresh and plain-language errors (Premium required, no active device) are unit-tested against a stand-in for Spotify; a **real Spotify account was not used**. Per-app volume from the plan is not built.

## Windows utilities

| Utility | Available behavior | Limit |
| --- | --- | --- |
| Controls | Master volume, supported brightness, Windows dark/light theme, Wi-Fi, Bluetooth, Night Light, and links to selected Windows Settings pages. | Brightness requires WMI monitor support. Radio and Night Light toggles rely on exposed Windows UI Automation controls. |
| Media | Read the current Windows media session and send play/pause/next/previous media key events. | Depends on active media-session support in Windows and the player. |
| Stats | CPU, memory, GPU, disks, network rates, uptime, process count, and top processes; values are queried locally. | GPU details can be absent. Stats are sampled rather than performance guarantees. |
| Internet speed | Optional M-Lab ndt7 download/upload measurement. | Transfers real data and publishes results including IP address; requires a per-run consent prompt. |
| Apps | Browse and launch installed applications; recent and favorite lists are local. | App discovery depends on Windows shortcuts and registered apps. |
| Wallpaper | Add a folder, browse discovered images, and apply a selection as the Windows desktop wallpaper. | User image files remain in place. Existing selected paths can become unavailable if files move. |
| Power | Lock, sleep, restart, or shutdown. | Each action shows an explicit confirmation. A restart/shutdown request is scheduled by Windows with a short delay. |

## Look and controls

Yami uses one visual system, Nightglow: indigo glass cards over a still night sky,
with lavender reserved for what is selected or switched on. The island notch and
its drawer are opaque, because a transparent window cannot blur what is behind it.
The [design system](reference/design-system.md) lists the tokens and components.

- **Menus.** Choices on shipped screens use Yami's own menu instead of the native
  list. Arrow keys and Home/End move through it, Enter or Space chooses, letters
  jump to a match, and Escape or Tab closes it. Focus stays on the menu button.
- **Tooltips.** Icon buttons and dock items show a short Yami tooltip after about
  0.4 seconds of hover, or 0.25 seconds of keyboard focus. The native Windows
  tooltip no longer appears. Tooltips add detail; every control keeps its label.
- **Status words.** Agent, connection and usage states are a word with a coloured
  dot. The colour adds emphasis; the word carries the meaning.
- **Motion.** Animation is kept to interaction and active work. Yami's Reduced
  motion setting (Settings > Behavior) or the Windows reduced-motion preference
  stops the transitions described here. Nothing keeps moving while you only
  look at a screen.

## Settings reference

The table lists source defaults; a user can change most values in Settings. Settings and app state are persisted locally.

| Settings group | Option | Default / choices | Notes |
| --- | --- | --- | --- |
| Yami | Your name | Empty | Included in the Gemini system prompt. |
| Yami | Your location | Empty | City or `latitude,longitude`; used for weather. |
| Yami | Personality | Alley Cat (`chad`) | Choose in loadout; `custom` reveals its editable prompt text. |
| Shortcuts | Enable shortcuts | On | Controls global voice/dictation/lasso shortcuts. |
| Shortcuts | Voice | `Win+Alt` | Hold to speak; release to finish. |
| Shortcuts | Dictation | `Ctrl+Win` | Hold to dictate. |
| Shortcuts | Circle to ask | `Ctrl+Shift` | Hold and draw a screen selection. |
| Dictation | Engine | Gemini (`gemini`) | `windows` uses an installed Windows speech recognizer; `whistle` uses the Offline dictation module's Whistle model; see AI > Dictation. |
| File wheel | Drag wheel | On | Tap a modifier during a file drag. Holding the key does not open the wheel. |
| File wheel | Convert / Tools / Actions | Shift / Ctrl / Alt | Each wheel uses a different modifier. |
| File wheel | Explorer shortcut | `Ctrl+Alt+Y` | Uses the files selected in the foreground File Explorer window. |
| File wheel | Reveal saved files | Off | Asks Explorer to show a finished file after a conversion or tool save. |
| File wheel | Petal sound | Off | Short tick when the highlighted petal changes. |
| Behavior | Memory | On | Includes saved facts in Gemini context; stored facts remain until deleted. |
| Behavior | Noise suppression | On | Requests noise suppression from the renderer audio capture chain. |
| Behavior | Reduced motion | Off | Reduces UI animation. |
| Behavior | Let Yami roam | On | Shows the roaming Yami window on the desktop. |
| Behavior | Living flame | Off | Keeps Yami's flame flickering at idle. Uses a little more power. |
| Behavior | Terminal commands | Off | Required before a model terminal tool is available; each command still asks confirmation. |
| Behavior | Raw desktop automation | Off | Required before coordinate clicks are available; each click still asks confirmation. |
| System | Start with Windows | Off | Uses Electron login-item settings. |
| System | Start quietly | Off | Show island without opening main window at startup. |
| System | Keep window on top | Off | Applies to the main app window. |
| System | Microphone | Windows default | Choose an enumerated input device. |
| API keys | Gemini API key | Empty | Required for chat, live voice, dictation, screen vision, and model tool calls. |
| API keys | Tavily API key | Empty | Optional for current web research and deep extraction. |
| Your data | Clipboard history | On | Can be disabled; see retention values below. |
| Your data | Clipboard retention | 30 days | Choices: 1, 7, 14, 30 days; pinned items remain until removed. |
| Privacy | App context | On | Sends open app names (not titles), unfinished to-dos, and cached news text to Gemini at setup. |
| Privacy | Location & weather | Off | Uses entered city if available; otherwise requests approximate IP location. |
| Privacy | Screen access | On request | Only the explicitly selected image is submitted. |

The source declares the voice and text defaults as `gemini-3.8-live` and `gemini-3.8-flash`, respectively. Provider model catalogs change; setup can choose a compatible model returned for the user’s API key. The saved model names are visible and changeable through settings/model discovery when supported.

## Light and dark on a schedule

Settings › System › **Light and dark on a schedule** switches Windows (apps and the system) to dark mode from an evening time and back to light from a morning time (default 19:00 and 07:00). A night schedule, with dark during the day, also works. Yami keeps one timer to the next switch. It applies the theme when you turn the schedule on or change the times, and at each switch, so a manual change in between stays until the next switch. It uses the same registry setting and broadcast as the Controls card's dark mode toggle. The rules are unit-tested; switching the real theme was **not exercised** in Yami's checks. Wallpaper rotation, accent sync and the rest of the Theme Hub from the plan are not built.

## Feeds inbox

Turn on **Feeds inbox** in Settings › Modules (or the Developer preset) and Desk gains a **Plans | Inbox** switch. Add a subreddit (`r/rust`), Hacker News, a GitHub repository's releases (`owner/repo`), a YouTube channel ID, a Bluesky profile (`name.bsky.social`, read from its public `/rss`), a Mastodon account (`@user@instance`, read from `/@user.rss`) or any HTTPS RSS, Atom or JSON Feed address. Untitled social posts use their text as the title. Items from every source are listed newest first; a chip per source filters the list, shows its last error on hover, and removes it. Opening an item opens your browser.

Feeds are read when the Inbox opens, and only for sources not read in the last ten minutes, or when you press refresh. There is no background timer. Each read sends the saved ETag and Last-Modified, waits at most 15 seconds, accepts at most 2 MB, refuses a redirect to plain HTTP, keeps the previous items when a read fails, and stores up to 50 items per source in `feeds.json`. Titles and summaries are shown as plain text, and only http(s) links are kept. Up to 50 sources. On 2026-10-28, Hacker News, GitHub releases and Reddit's public `.rss` feeds all answered. On 2026-10-28 a Bluesky profile and a Mastodon account also answered; Reddit may answer HTTP 429 when it is read several times in a few minutes, which the Inbox shows as "asked Yami to slow down". **Mail** sits at the top of the Inbox: up to five accounts (Gmail, Fastmail, iCloud Mail, Yahoo Mail or any IMAP server on port 993). Each shows its unread and total count and the five newest senders and subjects, read when the Inbox opens. You sign in with an app password, which is checked once when you add the account and then kept with Yami's DPAPI-encrypted credentials, never in `mail.json`. Yami opens INBOX with `EXAMINE` and reads headers with `BODY.PEEK`, so nothing is marked as read, moved, deleted or sent, and no message body or image is loaded. The protocol is unit-tested against a scripted server, and a real Gmail server answered TLS and refused a fake sign-in on 2026-10-28; reading a **real mailbox is not verified**. Outlook.com needs Microsoft OAuth, which is not built. **Brief me** sends the newest 40 headlines (source and title only, marked as untrusted data) to Gemini with your key and shows a short bulleted brief above the Inbox. It runs only when you press it, and without a key it asks for one. Home timelines that need sign-in are not built.

## Yami Browser and Vault

Turn on **Yami Browser** in Settings › Modules, then open it from the launcher (type "browser"). It is Electron's own Chromium in one window, with a vertical tab rail, back, forward and reload, and an address bar that takes addresses, searches (DuckDuckGo) and bangs (`!g`, `!ddg`, `!b`, `!w`, `!yt`, `!gh`, `!npm`, `!r`, `!mdn`).
- **Isolation:** pages run in their own `persist:yami-browser` profile in Yami's data folder, sandboxed, with no access to Yami or Node.
- **No device access:** every camera, microphone, location and notification request is refused.
- **Web pages only:** only http and https pages load; `javascript:`, `file:` and other addresses become a search.
- **Tabs:** a link that opens a new window opens a new tab instead, up to twelve tabs. A tab left in the background for five minutes is closed to free memory and reloads when you return to it ("asleep" in the rail).

The **Vault** imports bookmarks from Chrome, Edge, Brave, Vivaldi or Helium on this PC, read from each browser's plain `Bookmarks` file, and keeps them encrypted with Windows DPAPI in `vault.bin`. The new-tab page lists and filters them. Yami never decrypts other browsers' passwords or cookies.

With **Yami for your agents** on, the `browser_open` and `browser_read` tools (both off by default) let an agent open an address and read the current tab's title, address and visible text, while a "Reading this page for an agent" bar shows.

Checked on Windows on 2026-10-28 against a local test page: tabs, the page view's placement, background-tab sleep and wake, refusing `javascript:`, and an agent reading over MCP. **Linked browser mode.** Google, banks and some other sites refuse to sign in inside embedded browsers, and Yami does not disguise itself. So the new-tab page can open an installed Microsoft Edge, Google Chrome, Brave or Helium instead. It runs with its own Yami profile folder (never your usual profile) and a debugging port on `127.0.0.1:47824` only, so sign-ins work normally and `browser_read` reads that window while it is open. Closing it from Yami ends it. Checked on Windows with headless Edge reading a local test page. **Blocking.** Requests to a built-in list of about 35 well-known ad and tracker domains (DoubleClick, Google Analytics, Facebook's pixel, Criteo, Taboola, Hotjar and others), including their subdomains, are cancelled before they leave the PC. The shield in the toolbar shows how many were blocked and turns blocking off or on. It is a short, conservative list, not a full filter list like EasyList, so some ads still show. Checked on Windows with a local page whose tracker request was cancelled. **Reader and recent pages.** The book button shows the current page's main text (its `<article>` or `<main>`) as clean paragraphs in Nightglow, and the page steps aside while it is open. Finished pages join a recent list on the new-tab page, which holds up to 200 entries for this session and has a Clear button; it is not saved to disk. The plan's remaining parts are **not built**: full filter lists, history and password import, autofill, and agent clicking or typing.

## Yami Remote (phone)

Turn on **Yami Remote** in Settings › Phone and scan the pairing code with your phone's camera. Yami serves a small Nightglow page at `http://<this PC's home-network address>:47822/`, listening only on that private address and only while the module is on. The page shows agents that are working, and:
- **Approve agents** (on by default): a coding agent's permission request appears with **Deny** and **Allow once**, the same decision as the card on the PC.
- **Control music** (on by default): back, play/pause and next for what is playing on the PC.
- **Send to the clipboard** (off by default): text you send lands on the PC's clipboard, up to 10,000 characters.

Each ability has its own switch. The pairing code carries a token in the address's `#` part, which the phone keeps and removes from the address bar. Every request needs it, and **New pairing code** unpairs every phone. The page loads nothing from the internet, sets its text without HTML, and refreshes every four seconds only while it is visible. Yami Remote never shows the screen or controls the mouse, and it has no relay: away from home, use your own VPN such as Tailscale. Windows may ask once to let Yami through the firewall on private networks.

The server, its token and ability checks, and the phone page (pairing, an approval, HTML safety) were checked against a loopback address on 2026-10-28. Listening on the home network and a real phone were **not exercised**, to avoid a firewall prompt during unattended checks. The RustDesk bridge and Mailpit catcher from the plan are not built.

## Tune (Windows tune-up)

Turn on **Windows tune-up** in Settings › Modules (or the Tinkerer preset) and a **Tune** tab joins the dock. It lists fourteen per-user tweaks in five groups:
- **Explorer:** file extensions, hidden files, open to This PC, the classic right-click menu.
- **Taskbar and Start:** icons on the left, End task in the taskbar menu, seconds on the clock, no web results in Start search, no suggested apps.
- **Privacy:** no advertising ID, no tailored experiences, no tips.
- **Gaming:** no background game recording.
- **Comfort:** no Sticky Keys prompt.

Every tweak writes only `HKEY_CURRENT_USER` values through `reg.exe`, so there is no administrator prompt. Before changing anything, Yami writes the exact earlier values to `tune.json` in its data folder. Turning a tweak off restores them, removes values that were not set, and deletes a key Yami created. A tweak that was already set before Yami shows **Already set** and stays locked, because there is nothing of Yami's to undo. Tweaks that Explorer reads at start offer **Restart Explorer**, which asks first and never runs on its own. The tweak list was adapted from the ideas in Chris Titus Tech's WinUtil (no code copied). **Startup apps** lists what starts with Windows: your account's `Run` entries and Startup folder shortcuts, which you can switch off and on, and all-users entries, shown with **Needs admin** and not changed. Switching off works like Task Manager: Yami writes the `StartupApproved` entry (`03` and the time) and keeps the app's own entry; switching on writes `02`. **Network DNS** lists each connected network adapter with its DNS servers, read without administrator rights. Pick Cloudflare, Cloudflare for Families, Quad9, AdGuard DNS, Google Public DNS, or Automatic (back to your router's DNS). Yami asks first, then Windows shows one administrator prompt. A short elevated PowerShell receives only the adapter's number and a profile name from Yami's fixed list, sets the servers and clears the DNS cache. Reading DNS and refusing bad input were checked on Windows on 2026-10-28; **applying a change was not exercised**, because it needs your approval and changes the real network. DNS-over-HTTPS settings, AdGuard Home stats, other administrator tweaks, services and app removal are not built yet.

## Modules and first-run setup

A new profile opens **Choose your Yami**. Presets (Essentials, Developer, Tinkerer, Everything) or Custom switch the five modules: AI workspace, File wheel, Clipboard history, Weather and Roaming Yami. Each card shows what the module does, how much background work it costs, the permissions it uses, and its optional downloads. A module that is off never loads. Profiles saved before setup existed skip it and keep their choices. **Settings › Modules** switches modules any time and shows whether each one is awake; the tray's **Choose features…** reopens setup. The AI workspace sleeps until its page, an agent hook, a background refresh or its terminal shortcut needs it. While it is off, the AI tab is hidden from the dock and the island drawer.

Optional downloads (the file wheel's FFmpeg, ImageMagick, 7-Zip and ExifTool) can be queued in setup or from Settings › Modules, which shows progress and offers Cancel, Remove, Try again and **From file** (a file you downloaded yourself, checked against the same pinned checksum). Anything not downloaded still downloads the first time a tool needs it. Downloads run one at a time; removing one keeps your settings and files.

## Data controls

Settings includes provider-key replacement/removal, Tavily account usage display, clipboard history toggle/retention/clear, conversation history clearing, data export, and confirmed full-data deletion. Export omits credentials and clipboard; full deletion also removes keys. See [Security and provider data flow](security-and-providers.md#local-storage) for exact storage locations and protection.

## AI workspace and terminal

The AI tab and Yami Terminal are part of the app on `main`. They add agent session
hooks and approvals, subscription allowance readers, seven read-only service
connectors, selected context, a local model chat, HTTP MCP, notes and recordings,
dictionary and snippet rules, Windows speech and recaps. Terminal sessions are
interactive Windows PTYs. Defaults: monitoring, transcript fallback, background
usage and alerts are off; the terminal shortcut is empty; the terminal background
follows Yami at 6px blur and 22% opacity; scrollback is 3,000 lines; recap retention
is seven days. Dictation stays on Gemini unless a Windows recognizer is selected.
Its screens use the same cards, status words and meters as the rest of the app.
**Projects** keeps your project folders with their git state and starts any installed coding-agent CLI (Claude Code, Codex, OpenCode, Cursor CLI, Gemini CLI, Copilot CLI, Pi, Qwen Code, Amp, Aider, Crush or Goose) in a Yami Terminal tab there with one press.
Account, device and installed-agent verification limits are listed in the
[AI workspace and terminal guide](workspace.md).

## Known boundaries

- Windows sleep wake, microphone permissions, brightness, radio toggles, media sessions, and app discovery are affected by system state or hardware.
- Yami cannot act on the secure lock/UAC desktop or after a full shutdown.
- Plans uses the Windows date-and-time control (`datetime-local`). Its icon is tinted to match Yami, but the picker itself is still the Windows one.
- Clipboard and private-window exclusions are heuristics, not a universal privacy detector.
- The app does not send email, chat messages, or make purchases through its model tools. These are explicitly forbidden by the prompt and no such declared action exists.
- Terminal and coordinate tools are disabled by default. If enabled, they act with the signed-in Windows user’s privileges.
