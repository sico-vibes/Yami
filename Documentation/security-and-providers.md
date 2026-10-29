# Security and provider data flow

Yami runs locally and has no first-party telemetry, subscription server, or hosted application backend. Online features make direct requests from the Windows app to the destinations below. Provider terms, retention, training, prices, free quotas, model availability, and regional access belong to those services and can change. A free tier is account- and country-dependent and is not unlimited. The in-app disclosure notes that Google may use data submitted through the free tier to improve its products, subject to the user’s region and current Google terms.

## Provider connections

The optional [AI workspace](workspace.md) adds main-process read-only subscription
and service requests, explicitly configured model/MCP servers and selected
context. New keys share the Windows-encrypted credential file; broadcasts expose
only key-presence flags. Changing a server clears its bound key unless a new key
is supplied. HTTP is loopback-only; remote servers require HTTPS. Credential URL
fields, credential query parameters and redirects are blocked; output is bounded.

Usage reads existing client credentials without renewing/modifying them, running
inference or using reset credits. Provider-specific unpublished routes can change.
Service connectors provide status and links. HTTP MCP tools may have effects only
after tool-specific confirmation; they do not become automatic Gemini tools.

`workbench.json` stores local settings, notes, dictionary/snippet rules, cached
quota metadata and retained agent phase changes. Pending approvals are not saved.
`agent-relay.json` holds a random pipe token; the native relay checks the same
Windows user. This is not a sandbox against other same-user programs. Hook changes
require preview/confirmation and dated backups. Export includes workspace text
but excludes keys; full deletion removes the sidecar/relay config. CLI hook files
and backups are managed separately in the agent's configuration directory.

Recordings use bounded temporary PCM files: Gemini sends audio to Google; Windows
System.Speech stays local. Per-app cleanup and note summaries send text to Gemini
only when explicitly configured/requested. Discard/owner close/quit deletes audio;
provider/save failures retain it for retry while the view remains open. Temporary
recording storage is not durable crash recovery.

| Feature | Library / endpoint | Data sent | When it runs |
| --- | --- | --- | --- |
| Gemini chat, vision, tool calls, model discovery | `@google/genai` 2.30.0; Gemini Developer API `models.generateContent` and `models.list` | User prompt, recent conversation, optional selected image, function declarations and responses; the system prompt includes user name, time zone and behavior. If context or memory is enabled, their configured content is also included. | Chat, selected-image ask, key validation, or available-model refresh. |
| Gemini Live voice | `@google/genai` 2.30.0; `client.live.connect(...)` against the Gemini Live API | Microphone audio, conversation/system context, tool declarations and tool results; returned speech audio and transcription go back to the app. | While the user holds the voice shortcut or starts an explicit voice turn. Audio is streamed to Google. |
| Gemini dictation | `@google/genai` `models.generateContent` with audio inline data | Dictation recording and a fixed transcription instruction. | A dictation shortcut is released. The transcript is inserted into the original focused field. |
| Tavily key validation and usage | `GET https://api.tavily.com/usage` with `Authorization: Bearer <key>` | API key in the HTTPS authorization header. | When saving a Tavily key, or when refreshing displayed usage. |
| Tavily quick/deep search | `POST https://api.tavily.com/search` with JSON body (`query`, `search_depth`, `max_results: 5`, `include_raw_content: false`) | Research question and (for deep research) two Gemini-generated complementary queries. | Only when the user asks Yami for web research; deep mode only on explicit request. |
| Tavily deep extraction | `POST https://api.tavily.com/extract` with JSON body (`urls`, `extract_depth: "basic"`) | Up to five result URLs from that research request. | After a deep search returns sources. |

Yami configures the SDK with the user’s key and does not override its base URL. With the pinned `@google/genai` 2.30.0 SDK default, text/model-list calls use the Gemini Developer API host `https://generativelanguage.googleapis.com` and API version `v1beta`: generation is the SDK `models.generateContent` method on `models/{model}:generateContent`, while discovery uses `models.list` on `models`. Live voice uses a WebSocket under `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`; the SDK handles connection and authentication. These are SDK-resolved routes from the installed source, not URLs hard-coded in Yami. Current source defaults are `gemini-3.8-flash` for text and `gemini-3.8-live` for voice. Google’s available IDs may change; key setup discovers models for the user’s own account and can select another compatible text/live model.

For Tavily, current source issues one basic-depth search for a quick query and three advanced-depth searches for deep research. It counts two credits per deep search and one credit after successful extraction, for an implementation estimate of seven credits when extraction succeeds. The in-app copy currently describes 1,000 monthly free credits with no card; confirm current country eligibility, plan, and account usage directly with Tavily. The provider is authoritative for actual usage and plan rules. If extraction fails, the search may still return with fewer credits. Without a Tavily key, search goes to `https://en.wikipedia.org/w/api.php` using query parameters for Wikipedia search and returns up to five snippets. Wikipedia-derived public news context may also be loaded once per local day when AI context is enabled.

## Secret masking

With **Hide secrets before sending** on (Settings › Privacy, on by default), the main process replaces recognisable credentials in a chat message and its attached context before the Gemini request is built. That covers Anthropic, OpenAI, GitHub, Google, AWS, Slack and Stripe keys, JWTs, private key blocks, `password=`/`token=`-style values, and Luhn-valid card numbers. Each becomes a labelled placeholder such as `[hidden GitHub token]`, and a notice says what was hidden. The masked text is also what is kept in history. Pattern matching cannot catch every secret, so treat it as a safety net, not a guarantee. (Adapted from the idea in Magpie; no code was used.)

## Gemini request lifecycle

1. The app verifies that a Gemini key exists in the main-process store, then creates a `GoogleGenAI` client from `@google/genai` with that key. Request retry options are configured for up to three attempts.
2. For text chat, the app stores the user turn, constructs history from recent messages, builds the system instruction (personality, user name, current date/time and time zone, safety rules, recent messages, and any enabled memory/context), and calls `models.generateContent` with the configured text model and fixed tool declarations.
3. When Gemini returns a function call, the main process validates the action and its settings. Sensitive tools show the app’s confirmation dialog; if approved, only then does the dispatcher call the native host or local feature. The result or error is sent back as the function response and Gemini may continue. Text chat has a maximum of eight generation/tool-call rounds per user request.
4. For live voice, the app connects with `client.live.connect` and waits for setup completion before streaming microphone frames. Audio activity start/end boundaries are explicit. The Live API may call the same tools; the main process executes them and returns `sendToolResponse` results. When the user finishes, the session closes and transcripts are saved locally.
5. Dictation is a separate audio `models.generateContent` request with an instruction to transcribe and return only final text. It does not run recognized speech as an instruction. The app inserts the transcript into the original focused field through the native host and stores the transcript in chat history.

## Exact declared Gemini tools

Tool identifiers below are the function names in `electron/assistant.ts`. The policy and dispatcher on the local main process decide whether the requested operation can run; model output alone never bypasses those checks.

| Function | Behavior and limits | User gate |
| --- | --- | --- |
| `open_app` | Launch or focus an installed Windows application. | No confirmation. |
| `open_url` | Open a URL after HTTP/HTTPS scheme and embedded-credential checks. | No confirmation. |
| `search_web` | Research with Tavily or Wikipedia fallback; deep mode is explicit. | No additional prompt beyond the user’s research request. |
| `search_site` | Open search results on YouTube, Google, Amazon, Bing, or DuckDuckGo. | No confirmation. |
| `list_windows` | Return visible windows from the native host. | No confirmation. |
| `focus_app` | Focus a matching window title. | No confirmation; a nonempty target is required. |
| `close_app` | Close a matching window. | Always confirms. |
| `move_window` | Move/resize a matching window using supplied bounds. | No confirmation; a nonempty target is required. |
| `read_screen` | Read accessible visible control names in the foreground UI; skips password and off-screen nodes and caps traversal at 350 entries. | No confirmation. |
| `click_control` | Invoke/select/toggle an enabled accessible control by exact name. | Always confirms. |
| `click_desktop` | Click a raw screen coordinate. | Off by default; enable Raw desktop automation and confirm every click. |
| `insert_text` | Paste supplied text into the foreground field after capturing/restoring the original focus target. | Always confirms. The separate dictation insertion path is internal and not a model tool. |
| `set_volume` | Set master output volume from 0 to 100. | No confirmation. |
| `set_brightness` | Set monitor brightness from 0 to 100 and verify the observed value. | No confirmation; fails if monitor brightness is unsupported. |
| `set_theme` | Change Windows app/system light or dark theme. | No confirmation. |
| `media_control` | Send play/pause, next, or previous media key events. | No confirmation. |
| `add_todo` | Add a local to-do. | No confirmation. |
| `complete_todo` | Complete the first matching to-do title. | No confirmation. |
| `schedule_task` | Store a future reminder or an allowlisted action with `none`, `daily`, or `weekly` repetition; time must include a zone. | Only validated scheduled actions can run unattended. |
| `remember` | Save a requested local fact. | Requires Memory to be enabled. |
| `list_files` | List up to 150 entries from a user folder. | Home-folder path restrictions apply. |
| `read_file` | Read a UTF-8 text file up to 1 MiB. | Home-folder path restrictions apply. |
| `write_file` | Create or replace a text file. | Always confirms; home-folder path restrictions apply. |
| `move_file` | Move a file to a destination. | Always confirms; home-folder path restrictions apply. |
| `delete_file` | Move a file to the Windows Recycle Bin. | Always confirms; home-folder path restrictions apply. |
| `run_terminal` | Run a PowerShell command for up to 30 seconds; returns truncated stdout/stderr. | Off by default; enable Terminal commands and confirm every command. |

Scheduled work is narrower than the full tool set. The accepted inner actions are `remind`, `open_app`, `open_url`, `search_site`, `set_volume`, `media_control`, or `routine` with one to ten nested allowed actions. Sensitive operations are rejected from unattended execution.

## Other network destinations

- **Weather:** When enabled, an explicitly entered city is resolved against bundled GeoNames data. Without a city, Yami requests approximate IP location from `https://ipwho.is/`, then calls `https://api.met.no/weatherapi/locationforecast/2.0/compact` with rounded latitude and longitude. Location and weather are disabled by default.
- **AI workspace subscription quota (opt-in, manual refresh by default):** Claude reads `https://api.anthropic.com` usage with the existing CLI credential; Cursor reads `https://cursor.com/api/usage-summary`; Copilot reads `https://api.github.com/copilot_internal/user`; OpenCode Go reads `https://opencode.ai/inference/go/v1/usage` (OpenCode Zen credit is shown separately and is not a Go quota); Grok checks the `https://auth.x.ai` issuer and reads `https://cli-chat-proxy.grok.com/v1/billing`; Codex uses the local `codex app-server` process. A custom endpoint is any HTTPS (or loopback) URL the user enters. Yami does not sign in, refresh credentials, switch accounts or use reset credits.
- **AI workspace connectors (opt-in, read-only status):** GitHub (`https://api.github.com`), Vercel (`https://api.vercel.com`), n8n (the user's own server URL), Notion (`https://api.notion.com`), Cal.com (`https://api.cal.com/v2`), Resend (`https://api.resend.com`) and Stripe (`https://api.stripe.com/v1/charges`, read-only). Each uses a token the user supplies. Open links go to the service's own dashboard; Yami sends no email, charges or publishes through them.
- **Local model and MCP (user-configured only):** the local model chat calls the OpenAI-compatible server the user sets, by default `http://127.0.0.1:11434/v1`. HTTP MCP calls the server the user configures, and each advertised tool call needs its own confirmation. Remote servers must use HTTPS, and credential-bearing query parameters and redirects are refused.
- **File-wheel engines (downloaded on first use):** FFmpeg from `https://www.gyan.dev/ffmpeg/builds/`, ImageMagick from `https://github.com/ImageMagick/ImageMagick/releases/`, 7-Zip from `https://www.7-zip.org/`, and ExifTool from `https://sourceforge.net/projects/exiftool/` with checksums from `https://exiftool.org/`. Each download is checked against a pinned SHA-256 before it is run. No file is sent to these hosts; they are fetched only when a job needs that engine. LibreOffice is never downloaded.
- **Whistle offline dictation (opt-in download):** choosing Whistle downloads `needle.exe` and `whistle.cact` from `https://huggingface.co/Cactus-Compute/`, pinned to a repository commit and checked against a SHA-256 before use. After that, dictation sends nothing anywhere: the recording is written to a temporary WAV, transcribed by the local runner, and deleted.
- **Feeds inbox (opt-in module):** the addresses you add, such as `https://www.reddit.com/r/<name>/.rss`, `https://news.ycombinator.com/rss`, `https://github.com/<owner>/<repo>/releases.atom` and `https://www.youtube.com/feeds/videos.xml`. They are read only when the Inbox opens or you refresh, with the user agent "Yami desktop feed reader". No account, cookie or key is sent.
- **Lyrics (opt-in, Settings › Privacy):** `https://lrclib.net/api/get` with the playing track's artist, title and length, once per track while the island's media card is open. No account or key.
- **Yami for your agents (opt-in module):** a listener on `127.0.0.1:47821` only, while the module is on. Each request needs the bearer token (48 hex characters, DPAPI-encrypted with other credentials); requests with a web `Origin` that is not this PC are refused; bodies over 256 KB are dropped. No tool changes files or settings; `ask_user` uses the same approval card and two-minute timeout as Yami's own sensitive actions.
- **Mail glance (opt-in, Feeds module):** IMAP over TLS 1.2+ to the server you choose (for example `imap.gmail.com:993`) when the Inbox opens. Commands are LOGIN, STATUS, EXAMINE, a header-only FETCH with BODY.PEEK, and LOGOUT. App passwords are DPAPI-encrypted with other credentials.
- **Tune administrator (opt-in):** a restore point and stopping DiagTrack or MapsBroker start an elevated `powershell.exe` through Windows' consent prompt with fixed arguments (`native/Admin.ps1 -Mode service -Name <one of two> -Start <one of three>`, or `-Mode restore-point`). The elevated script writes its result to a temporary file Yami reads and deletes. Declining the prompt changes nothing.
- **Tune installed apps (opt-in):** listing reads Uninstall registry entries only. Uninstall, after a confirmation, starts the `UninstallString` the app registered (the command Settings › Apps runs). The page sends an id from the last list, so it can never pass Yami a command; Yami itself never elevates it.
- **Tune DNS (opt-in, administrator):** changing an adapter's DNS starts an elevated `powershell.exe` through Windows' consent prompt. Its arguments are fixed (`native/Dns.ps1 -Mode apply -Index <number> -Profile <known id> -Encrypt on|off`); the server and DNS-over-HTTPS addresses come from the script's own table, and encryption writes only DoH keys for those known servers. Declining the prompt leaves DNS unchanged.
- **Yami Remote (opt-in module):** an HTTP listener on this PC's private IPv4 address, port 47822, only while on. Every API call needs the 48-hex pairing token (DPAPI-encrypted); the page has a strict Content-Security-Policy and no external resources; bodies over 16 KB are dropped. Abilities (agent approvals, media, clipboard) each have a switch, and clipboard is off by default. Traffic is plain HTTP on the home network, so use it only on networks you trust.
- **Yami Browser (opt-in module):** pages load in a separate, sandboxed `persist:yami-browser` session with every permission request refused and only http(s) navigation. The Vault reads other browsers' plain `Bookmarks` JSON files only when you press Import, and stores bookmarks DPAPI-encrypted in `vault.bin`. Agents can read the current tab's visible text only through the `browser_read` tool, which is off by default.
- **Spotify (optional):** `https://accounts.spotify.com` for PKCE sign-in and token refresh, and `https://api.spotify.com/v1/me/player…` for playback state, devices, play/pause, skip, volume and transfer, only after you connect your own app. The redirect lands on a one-off `127.0.0.1:47823` listener; the refresh token is DPAPI-encrypted.
- **Feeds brief (explicit):** pressing Brief me sends up to 40 headline titles and source names to Gemini as data. No mail subject, address or body is included.
- **Linked browser (Yami Browser, on request):** starts your installed Chromium browser with `--user-data-dir` inside Yami's data folder and `--remote-debugging-port=47824 --remote-debugging-address=127.0.0.1`. Any program on this PC could talk to that port while the window is open, so close it when you are done; Yami reads page text through it only for the `browser_read` tool.
- **Speed test:** The user must confirm before running the bundled `@m-lab/ndt7` client and its worker scripts. M-Lab publishes results, including the user’s IP address, in an open dataset; the test transfers real data.
- **External links:** the app opens HTTP or HTTPS URLs in the default browser. It rejects other protocols and URLs containing embedded credentials.
- **App shortcuts:** launcher destinations include websites such as Gmail, YouTube, and Amazon. No account login information is read by Yami.
- **Optional location, microphone, and OS settings:** opening Windows settings is a local operation. Microphone capture requires the user to begin a voice/dictation action and is subject to Windows permission.

## Local storage

The data directory is Electron’s Windows `userData` path, normally under `%APPDATA%\yami`. A development override can set `YAMI_DATA_DIR` for isolated verification. The state file is `data.json`; credentials are stored separately in `credentials.bin`.

When loaded data contains the retired `gemini-2.5-flash` or `gemini-2.5-flash-native-audio-preview-12-2025` setting, the current store replaces that model identifier with its supported current default. This model-setting migration does not clear conversations, other state, or provider credentials.

| Data | Storage / behavior |
| --- | --- |
| Settings, recent apps, app favorites, loadout, conversations, tasks, memories, snippets, usage counters, wallpaper paths | `data.json`, written locally with a temp-file/rename pattern. |
| Gemini and Tavily API keys | Encrypted with Electron `safeStorage` backed by Windows protection; stored in `credentials.bin`, never placed in renderer state or exported. Yami refuses to save keys if encryption is unavailable. |
| Unpinned clipboard entries | Encrypted with `safeStorage` before being serialized to `data.json`. |
| Pinned clipboard entries | Saved as readable text in `data.json` so they can remain directly usable. Pin only material you are comfortable storing unencrypted in your user profile. |
| User-selected wallpapers | The filesystem path is stored; the selected image remains wherever the user keeps it. |
| AI workspace settings, notes, dictionary and snippets, cached quota metadata, retained agent phase changes | `workbench.json` in the user-data folder, written with a temp-file/rename pattern. Pending approvals are not saved. Export includes workspace text and excludes keys. |
| Agent relay pipe token | `agent-relay.json`; the native relay checks that the connecting process belongs to the same Windows user. |
| Subscription and connector credentials | Entered by the user and stored in `credentials.bin` with the other keys, never in `workbench.json` or the renderer. |
| Recording audio | Bounded temporary PCM files that are deleted on discard, owner close or quit. They are not crash-recovery storage. |
| File-wheel engines | `%LOCALAPPDATA%\Yami\engines`. Each download is checked against the pinned SHA-256 in `electron/wheel/engine-catalog.ts` before it can run. |
| File-wheel outputs | New files saved beside the original; the source file is never overwritten. |
| Exported file | Includes settings, conversations, plans, memories, and other app state as implemented; excludes credentials and clipboard history. |

Yami supports export, history clearing, clipboard clearing, and a separately confirmed full local-data deletion. Clearing all data also removes the provider keys. Do not use exports as secret backups: they are not encrypted by Yami.

Clipboard history is enabled by default, polls every 1.8 seconds, stores a maximum of 500 entries, and removes unpinned entries after a setting of 1, 7, 14, or 30 days. The default is 30 days. It skips empty/duplicate/oversized strings, common API-key patterns, Windows private clipboard markers, password fields, a set of known password-manager process names, and windows whose title resembles a banking product. This is best-effort application detection, not a guarantee that every sensitive window is recognized. Disable clipboard history if that protection is insufficient.

## Context switches

- **Memory** is enabled by default. Saved user facts stay local and are added to Gemini’s prompt when memory remains enabled. You can edit or delete individual memories or clear all memories.
- **App context** is enabled by default. At conversation setup, Yami may send open application process names (not window titles), unfinished to-dos, and cached Wikipedia news text to Gemini. The UI setting is **Settings → Privacy → Let it see what’s going on**.
- **Screen selection** is sent only after the user explicitly draws and submits a lasso selection to Gemini. Screen capture itself occurs locally first.
- **Weather and approximate IP location** are opt-in and disabled by default.
- **Speed test** has a separate per-run disclosure and consent.

## Action permissions and confirmations

The model cannot execute arbitrary named functions. `electron/assistant.ts` publishes a fixed Gemini function-declaration list; the Electron main process dispatches a matching allowlist and returns the result or error.

AI workspace actions follow the same rule. An agent permission request is decided in Yami only after the Yami card is shown and acknowledged within 1.2 seconds; otherwise the CLI keeps control and nothing is granted silently. Terminal sessions start only when the user opens one. File-wheel conversions and tools run only after the user drops a file on a petal, and they write a new file beside the original.

Always-confirm actions are: close a window, activate a UI Automation control, click a raw screen coordinate, insert arbitrary text into a foreground field, write/replace a file, move a file, recycle a file, and run a PowerShell command. Power actions (lock, sleep, restart, shutdown) also require a separate explicit confirmation in the app. Confirmation requests expire after two minutes; declining or timing out cancels the action. Terminal and raw coordinate automation are disabled by default and each also requires its respective setting to be enabled.

App launch, opening a validated HTTP/HTTPS link, supported site search, focus/move window, accessible screen read, volume, supported brightness, theme, media control, to-do changes, and user-requested memory actions do not use the confirmation dialog. Device support and actual returned results still control whether Yami reports success. Scheduled actions must be from a narrower allowlist: reminder, app launch, URL open, site search, volume, media control, or a routine containing up to ten allowed steps. File changes, arbitrary UI clicks, power, terminal, and raw desktop clicks cannot be scheduled unattended.

File listing, reading, writing, moving, and recycling are restricted to paths beneath the current user’s home directory. The main process excludes the app-data, `.ssh`, `.aws`, and `.codex` top-level folders and files with `.env`, `.pem`, or `.key` extensions. This path check does not turn the native host into a filesystem sandbox.

The assistant prompt instructs the model to treat web pages, files, screen text, and tool results as untrusted; not reveal secrets; clarify ambiguous actions; and not claim success without a successful result. Prompt instructions supplement, but do not replace, main-process validation and confirmation.

## Practical security limits

Yami acts as the current Windows user. The native host is not an OS sandbox. PowerShell access can do anything that account can do once explicitly enabled and confirmed; understand the exact command shown before approval. Window focus, UI Automation, power timers, brightness, and media features depend on the desktop session, hardware, Windows policy, and target application.

API-key encryption protects the local secret at rest with Windows user-bound storage; it is not protection from malware running as the same user or from an unlocked session. Clipboard, text entry, screenshot, and app detection are feature-specific best efforts, not a general data-loss prevention system.

Read the [Google Gemini API terms](https://ai.google.dev/gemini-api/terms), [Google Gemini API documentation](https://ai.google.dev/gemini-api/docs), [Tavily API reference](https://docs.tavily.com/documentation/api-reference/introduction), and [Tavily plan details](https://tavily.com/#pricing) for current provider rules. This guide is a source-derived description of Yami’s calls, not provider legal advice.
