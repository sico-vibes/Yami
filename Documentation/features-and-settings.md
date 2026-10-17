# Features and settings

This guide describes features currently represented in the source. Hardware-dependent behavior can be unavailable, and provider-backed features depend on the connected account. An idea absent from this page may be planned; see [Roadmap](roadmap.md).

## Companion and conversation

**Yami, the cat-ghost.** Yami is drawn as a white cat-ghost with a wispy tail (`src/yami/`). Her tail, ears, eyes and body move while she is hovered, listening, thinking, speaking or being carried, then settle to a still pose and stop requesting animation frames. Reduced motion shows static poses.

**Spirit island.** A small top-center transparent island can open the main app and utility panel, display listening/thinking/speaking state, and accept the configured ability trigger. While Yami runs a tool, a small card under the island names the action (for example "Opening Spotify"). Scrolling down on the island opens the drawer; scrolling up at the top of the drawer tucks it away. It remains in the Windows tray when the main window is closed. Quit Yami from the tray to stop background work.

**Roaming.** With **Let Yami roam** on (Settings > Behavior, or the tray menu), Yami floats in a small click-through window on the desktop. She dodges the cursor twice with a quip, then lets you catch her: click opens Yami, drag moves her. She drifts to a nearby spot every few minutes (skipped on battery), naps after a minute alone, and flies into the island during voice and dictation turns.

**Captions.** During a voice or dictation turn a pill at the bottom of the screen shows the held shortcut keys, your live transcript (`You`), then Yami's reply (`Yami`). The caption window exists only for the turn and closes a few seconds after it ends.

**Text chat.** Home sends text to Gemini’s text model. Up to the latest eight messages are included in the system prompt and up to 16 messages are used to construct request history. The turn can invoke declared tools, with a maximum of eight tool-call rounds. If no Gemini key is configured, chat is unavailable while local utilities remain available.

**Live voice.** Hold the voice shortcut or press the island ability button, speak, then release to finish. Voice connects through the Gemini Live API and streams audio. Yami uses explicit speech activity start/end boundaries; it does not send continuously when idle. A voice turn can make the same declared tool calls as text chat. A lasso selection with Gemini connected starts a one-shot voice question about the selected image.

**Dictation.** Hold the dictation shortcut. Yami remembers the foreground window handle, captures speech, asks Gemini to transcribe and resolve spoken corrections, then inserts the final text into that original field using clipboard-preserving paste. Password fields are rejected by the native host. Dictation text is also retained in conversation history.

**Circle to ask.** Hold the lasso shortcut, draw a loop around anything on screen, and complete the selection. Capture occurs locally. With Gemini connected, the selected image can be sent with a voice turn; without a key, the image appears in the console selection. Cancel with Escape.

**Embers, skins, voices, personalities, and abilities.** The loadout presents cosmetic options and unlock prices for Yami. The current implementation awards an ember per completed voice turn or dictation. Soul, voice, personality, and ability choices are saved locally; they do not represent provider billing or a verified recreation of an original reward system. Paid voice cards use Gemini prebuilt voices and delivery prompts; they are not separately trained voices. The custom personality editor appears after that option is owned.

| Slot | Shipped choices and ember costs |
| --- | --- |
| Skin | Yami free; Ember 160; Wisp 160; Amethyst 400; Gilded 400; Void 1,000. Each is the same cat-ghost in a different colourway. Saved `hitodama` selections from earlier builds migrate to `yami` on start. |
| Voice | Charon free; Puck, Leda, Aoede, Enceladus, Algenib, Laomedeia, Jack, Ankit, Cheng, and Linda cost 240 each. Several named personas map to Gemini prebuilt voices plus delivery instructions. |
| Personality | Alley Cat free; New/custom personality 100. |
| Ability | Collapse is included with Void; Sidearm costs 400. The ability is armed by tapping the island and triggered by its configured mouse or keyboard binding. |

The visible price/catalogue system is a local product feature, not a provider subscription or proof of the original application’s unlock economics.

When an ability is equipped, the loadout’s **Trigger button** row captures a keyboard key or one of the primary mouse buttons. Escape cancels capture. Click Yami in the island while idle to arm the ability; the next captured trigger fires it and disarms it.

## Research and action tools

With Tavily connected, a quick search uses one basic search request. Deep research is opt-in per request, asks Gemini for two complementary queries, makes three advanced searches, and may extract source content for up to five results. Sources are shown with the answer. Actual credits are controlled by Tavily; the implementation’s expected count is detailed in [Security and provider data flow](security-and-providers.md). Without Tavily, search falls back to Wikipedia and returns up to five snippets.

Gemini can use the declared tool set described in [Architecture](architecture.md) and [Security and provider data flow](security-and-providers.md): launch a Windows app, open HTTP/HTTPS URL, open supported site search, inspect windows, focus/move/close a window, read accessible screen controls, activate an accessible control, click a raw coordinate, insert text, change volume/brightness/theme, control media, manage to-dos, schedule allowed work, save a memory, read/list files, write/move/recycle a file, or run PowerShell when enabled. Confirmations and restrictions are applied by the Electron main process.

## Productivity and organization

**Today.** A clock card, a weather card when weather is enabled, a week strip with dots on days that have scheduled plans (pick a day to list them), a focus timer, and the to-do list. The focus timer offers 1, 5, 10, 15 and 30 minute presets; the main process owns the countdown, so it finishes with a Windows notification even when the panel is closed.

**Plans.** Save a one-off or repeating reminder, app launch, URL open, site search, or routine of several app launches. Repeat options are once, daily, and weekly. Routines can have one to ten allowlisted actions. Yami checks due work while running, including while minimized to the tray, and checks missed work when it resumes. A waitable timer requests that Windows wake a sleeping PC for the next due time. This is subject to Windows policy, firmware, hardware, and session availability.

**Memory.** Create, edit, or delete explicit facts. Memory is local; when the memory setting is on, saved facts enter Gemini’s prompt. A user may turn memory off without deleting stored entries.

**Launcher.** `Win + A` searches installed apps, local files, and saved snippets. Favorite/recent apps are local. A chosen app launches through the Windows shell. Snippets can be stored, copied, and removed.

**Clipboard.** When enabled, Yami polls for text and keeps up to 500 entries. Choose a retention period of 1, 7, 14, or 30 days. Pinned entries do not expire automatically; they are stored unencrypted in `data.json`, while unpinned entries are encrypted. Copy, pin, delete, clear, and search history from the utility panel. See [security limitations](security-and-providers.md#practical-security-limits) before relying on exclusions.

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
| Behavior | Memory | On | Includes saved facts in Gemini context; stored facts remain until deleted. |
| Behavior | Noise suppression | On | Requests noise suppression from the renderer audio capture chain. |
| Behavior | Reduced motion | Off | Reduces UI animation. |
| Behavior | Let Yami roam | On | Shows the roaming cat-ghost window on the desktop. |
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

## Data controls

Settings includes provider-key replacement/removal, Tavily account usage display, clipboard history toggle/retention/clear, conversation history clearing, data export, and confirmed full-data deletion. Export omits credentials and clipboard; full deletion also removes keys. See [Security and provider data flow](security-and-providers.md#local-storage) for exact storage locations and protection.

## Known boundaries

- Windows sleep wake, microphone permissions, brightness, radio toggles, media sessions, and app discovery are affected by system state or hardware.
- Yami cannot act on the secure lock/UAC desktop or after a full shutdown.
- Clipboard and private-window exclusions are heuristics, not a universal privacy detector.
- The app does not send email, chat messages, or make purchases through its model tools. These are explicitly forbidden by the prompt and no such declared action exists.
- Terminal and coordinate tools are disabled by default. If enabled, they act with the signed-in Windows user’s privileges.
