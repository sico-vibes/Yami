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

## Feeds inbox

Turn on **Feeds inbox** in Settings › Modules (or the Developer preset) and Desk gains a **Plans | Inbox** switch. Add a subreddit (`r/rust`), Hacker News, a GitHub repository's releases (`owner/repo`), a YouTube channel ID or any HTTPS RSS, Atom or JSON Feed address. Items from every source are listed newest first; a chip per source filters the list, shows its last error on hover, and removes it. Opening an item opens your browser.

Feeds are read when the Inbox opens, and only for sources not read in the last ten minutes, or when you press refresh. There is no background timer. Each read sends the saved ETag and Last-Modified, waits at most 15 seconds, accepts at most 2 MB, refuses a redirect to plain HTTP, keeps the previous items when a read fails, and stores up to 50 items per source in `feeds.json`. Titles and summaries are shown as plain text, and only http(s) links are kept. Up to 50 sources. On 2026-10-28, Hacker News, GitHub releases and Reddit's public `.rss` feeds all answered. Mail, Bluesky, Mastodon timelines and a "Brief me" digest from the plan are not built yet; Mastodon's public `@user.rss` feeds work as "Any feed".

## Tune (Windows tune-up)

Turn on **Windows tune-up** in Settings › Modules (or the Tinkerer preset) and a **Tune** tab joins the dock. It lists fourteen per-user tweaks in five groups:
- **Explorer:** file extensions, hidden files, open to This PC, the classic right-click menu.
- **Taskbar and Start:** icons on the left, End task in the taskbar menu, seconds on the clock, no web results in Start search, no suggested apps.
- **Privacy:** no advertising ID, no tailored experiences, no tips.
- **Gaming:** no background game recording.
- **Comfort:** no Sticky Keys prompt.

Every tweak writes only `HKEY_CURRENT_USER` values through `reg.exe`, so there is no administrator prompt. Before changing anything, Yami writes the exact earlier values to `tune.json` in its data folder. Turning a tweak off restores them, removes values that were not set, and deletes a key Yami created. A tweak that was already set before Yami shows **Already set** and stays locked, because there is nothing of Yami's to undo. Tweaks that Explorer reads at start offer **Restart Explorer**, which asks first and never runs on its own. The tweak list was adapted from the ideas in Chris Titus Tech's WinUtil (no code copied). Administrator tweaks, services, app removal, the DNS switcher and the startup manager from the plan are not built yet.

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
