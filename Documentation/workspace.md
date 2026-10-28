# AI workspace and Yami Terminal

The AI dock tab uses Yami's Nightglow cards, status words, meters and Select menus,
with the same settings navigation, rounded controls, Phosphor icons and reduced-motion
behaviour as the rest of the app. It contains Sessions, Usage, Connections, Context,
Dictation, Notes, Recap, MCP and Workspace settings.
The island's AI utility shows a compact activity view and pending decisions.
The implementation is on the `main` branch and in the local portable build from
2026-10-18. No public release has been published.

![AI workspace with synthetic activity](assets/screenshots/workspace.png)

## Screens

Each page opens with the same header: a light title, one muted line and at most one
action. Lists are cards, choices are Yami menus, and an empty page says what to do next.

- **Sessions.** One card per agent session: an icon tile, the project, the agent's
  name (for example Claude Code), its source and how long ago it was seen, a status
  word and the latest detail. Changed files sit behind a disclosure as file chips.
  Each chip shows its full path on hover and opens the bounded diff. Dismiss removes
  the card. Pending permission requests appear in a dialog over the page.
- **Projects.** Folders you add, each as a card: name, path, branch, how many paths
  changed, commits ahead and behind, and the latest agent session reported there.
  Yami runs `git status --porcelain=v2 --branch` (five-second limit, four folders at a
  time) when the page opens, when you press refresh, or when the list changes. It
  never runs git on a timer or on agent events. Above the cards, the coding-agent CLIs
  found on this PC are listed. Yami looks on PATH and in npm, WinGet, Scoop, Bun and
  Cargo folders, preferring a real `.exe` over npm's `.cmd` and `.ps1` shims, when the
  page first opens or on refresh. Each card has a tile per installed agent: pressing
  one opens a Yami Terminal tab in the folder and types that agent's command (for
  example `claude` or `cursor-agent`), then remembers it as the card's **Start**
  button. Commands come only from Yami's list of twelve CLIs (Claude Code, Codex,
  OpenCode, Cursor CLI, Gemini CLI, Copilot CLI, Pi, Qwen Code, Amp, Aider, Crush and
  Goose); the page never sends a command line. **Terminal here**, **Explorer** and,
  when VS Code or Cursor has registered its link scheme, an editor button open the
  folder. "Folders your agents worked in" suggests folders that agent sessions
  reported, so you can add them with one press. Forgetting a project never touches
  its files. The tiles show two-letter marks, not brand logos. The command names were
  checked against installs on one PC (Claude Code, Codex, OpenCode, Gemini CLI and
  Crush); the others follow each project's documentation and are **not verified** here.
- **Parallel tasks.** A git project's card has a **Parallel tasks** list, read only
  when you open it. **New task** runs `git worktree add -b yami/<name>` into a
  `<project>.worktrees/<name>` folder beside the project and opens a Yami Terminal tab
  there, starting the chosen agent if you picked one, so several agents can work side
  by side without touching your checkout. Each task shows its branch and folder, with
  a terminal button and **Remove**, which asks first and runs `git worktree remove`.
  Git refuses when the folder has uncommitted changes, and Windows refuses while a
  terminal or editor still has it open; Yami says which. The branch and its commits
  stay.
- **Fan out** (Orca's idea) sends one task to two to four agents at once. Write the
  task, pick the agents and Yami makes a worktree for each on a
  `yami/<task>-<agent>` branch, writes the task to `.yami-task.md` there, adds
  `/.yami-task.md` once to the repository's shared `.git/info/exclude` so it is never
  committed, and opens a terminal tab per agent with a fixed first prompt: `Read
  .yami-task.md in this folder and do the task it describes.` Your text is never typed
  into a shell, so no quoting can turn it into a command. Only agents whose interactive
  start takes a prompt are offered, as checked in each CLI's own `--help` on
  2026-10-28: Claude Code, Codex and Gemini CLI (an argument) and OpenCode
  (`--prompt`). Crush has no prompt option for its interactive mode, and the CLIs not
  installed here were not checked, so they are left out. If one worktree fails, the
  ones already started keep running and the message says how many. Remove the tasks
  from the same list once you have picked a result. Comparing the agents' diffs side by
  side is not built yet. On 2026-10-28 a one-file task was fanned out to the real Claude Code and
  Codex in a throwaway repository: both started in their own worktrees with the fixed first prompt,
  read `.yami-task.md`, and wrote `HELLO.txt` containing *hello*. Each agent first asks whether
  to trust the new worktree folder (Claude Code's default answer is *No, exit*), so expect one
  trust prompt per task. Codex also printed "Hook failed" after each step in that run. The cause was Yami's own Codex
  hook: Codex 0.163 on Windows runs hook commands with PowerShell, and Yami wrote them as
  `"path" codex Event "config"`, which PowerShell reads as a string ("Unexpected token
  'codex'"). Yami now writes Codex hooks as `& 'path' codex Event 'config'`, like its Gemini and
  Copilot hooks, which ran in both PowerShell 7 and Windows PowerShell; pressing Install for
  Codex again in Connections updates an older install. Codex then asks you to review the changed
  hooks once before it runs them.
- **Agents calling Yami (MCP page).** Turn on **Yami for your agents** and Yami serves
  an MCP endpoint at `http://127.0.0.1:47821/mcp` (streamable HTTP, JSON replies,
  protocol 2025-06-18). It listens on this PC only, needs a bearer token kept with
  your other credentials (DPAPI), refuses requests from web pages (a browser
  `Origin` that is not this PC), and stops when the module is off. Tools, each with its
  own switch: **notify** (shows in Yami's caption), **ask_user** (Yami's approval card;
  no answer in two minutes is no), **list_projects**, and **open_terminal** (off by
  default; opens a tab in a project and runs nothing). The page shows the address, a
  copy button for the `Authorization` header and a ready `claude mcp add` command, and
  **New token** locks out the old one. Registering it with each agent CLI is up to
  you; Yami does not edit agents' MCP settings. Other agents take the same address and
  header as a streamable HTTP server; that was **not verified per agent**.
- **Usage.** Allowance alerts and background refresh are two toggles. Each provider
  that has been read gets a card with its account, source, status word, and each
  limit as a label, a meter, a percentage and a reset time, grouped by account.
  Providers not read yet sit in a tile grid under "Not read yet", each with a Read
  button. A provider is read only when you press its button, or when background
  refresh is on and it has been read before. The custom endpoint form is at the bottom.
- **Recap.** Three stat tiles count completed turns, sessions and projects in the
  last seven days. Below them, each project has a timeline card: agent, status word
  and time. With no events, the page shows an empty state.
- **Notes.** A collapsed meeting recorder card sits above the notes. The list card
  holds search and saved notes; the editor card holds the title and body, then the
  summary and proposed Desk actions, each with an "Add to Desk" button.
- **Dictation, MCP and Workspace.** Plain settings are grouped rows. Dictionary rules
  and per-app cleanup are form cards: an input row with a primary Add button, then
  saved rows separated by hairlines. The MCP page uses a card for its server and its
  tool call. The default shell and background are Select menus; blur and opacity are
  sliders.
- **Connections and Context.** Connections are one card per service showing its state
  and quota items. Context lists attached items as cards, and window context is a row.
- **Island pill.** Under the collapsed island, a pill shows the most urgent active
  agent: one waiting for you, then an error from the last 15 minutes, then ones
  working or thinking. With two or more active, it shows a count (for example 1/3)
  and moves to the next every four seconds; scrolling over it steps by hand and
  hovering holds it. Cycling stops when fewer than two agents are active, while the
  drawer is open, and while Yami's own activity is shown. A newly most-urgent agent
  shows at once.
- **Yami reacts.** When the latest agent session finishes, Yami hops once (cheer);
  on an error it tilts its head (worried); when an agent waits for you its ears go up
  (alert). Each reaction lasts 1.6 seconds and plays once per change; the first update
  after the island opens only sets the baseline. With Reduced motion on (in Yami or in
  Windows) there is no reaction.
- **Island drawer, AI tab.** Two columns. On the left, Agent activity lists the five
  latest sessions with their status words. On the right, Open Yami Terminal is the
  primary button, Open AI workspace is soft, and an Allowance card shows up to three
  usage meters. With no agents connected, the drawer says to connect them from the
  AI workspace.

## Terminal

**Shells and search.** Yami Terminal can open PowerShell 7, Windows PowerShell, Command Prompt, **Git Bash** (found where Git for Windows installs, never WSL's `bash.exe`, started as a login shell) and **WSL** (your default distribution). The default is set in Workspace settings, and a **Shell for new tabs** menu beside **+** picks one for the next tab. **Ctrl+Shift+F** (or the magnifier) opens a find bar for the selected tab's scrollback: Enter finds the next match, Shift+Enter the previous, and Escape closes it. Search uses xterm's own search addon (`@xterm/addon-search` 0.16.0, MIT). **Split view.** The columns button shows two tabs side by side: the selected tab on the left takes input, and another tab sits dimmed on the right. If there is only one tab, Split opens a new one. Pressing the right pane swaps the two, and ending either one, or pressing the button again, goes back to one tab. **Shell integration.** Shells Yami opens report their folder (OSC 7) and mark each prompt (OSC 133, the marks VS Code and Windows Terminal read). Yami wraps your own prompt rather than replacing it: PowerShell starts with `-NoExit -EncodedCommand` and a `prompt` function that calls your profile's prompt; Git Bash gets `PROMPT_COMMAND` (a `.bashrc` that sets its own `PROMPT_COMMAND` replaces it, so the marks go away there); Command Prompt gets a `PROMPT` built around yours, which reports the folder but cannot report exit codes; WSL is left alone. The footer shows the tab's current folder and how the last command ended (**Done** or **Exit n**, with its time), finished commands are coloured in the scrollbar's overview ruler, **Ctrl+Up / Ctrl+Down** jump between prompts, and the clipboard button copies the last command with its output. A command that ran for 10 seconds or more and ends while the terminal is hidden or unfocused raises the usual Yami notice. **Shell integration** in Workspace settings turns it off for new sessions. On Windows on 2026-10-28 the desktop check ran PowerShell 7 (with this PC's own profile), Windows PowerShell, Command Prompt and Git Bash through ConPTY and confirmed the folder for all four, `Exit 4` and the copied block for the three that report exit codes, and the hidden-window notice. This also fixed copy and paste in Yami's own windows: the default session had refused the renderer's clipboard permission, so Ctrl+Shift+C / V in the terminal failed with "Write permission denied". Clipboard access is now allowed only for Yami's own windows. More than two panes, link detection, profiles for SSH hosts and layout restore from the plan are not built.

Open the terminal from Sessions or the island AI utility. Set a global launch
shortcut in Workspace; the main Hotkeys switch also controls this shortcut.
The default shortcut is empty to avoid taking an existing key combination.
Auto shell prefers PowerShell 7, then Windows PowerShell, then Command Prompt.
You can explicitly choose a shell, open a working folder, add up to eight tabs,
resize, paste/copy with Ctrl+Shift+V/C, interrupt with Ctrl+C and attach selected
output to chat. Closing the terminal window hides its live sessions. End session
terminates that shell and its descendants; quitting Yami terminates all owned
shells. It is an interactive Windows PTY, not the assistant's one-shot shell tool.

![Terminal with synthetic browser text](assets/screenshots/terminal.png)

The default background follows Yami's image, with a bundled fallback, 6px blur
and 22% opacity. Choose a static JPG/PNG (up to 15 MB), no background, blur 0–30px
and opacity 0–80%. Scrollback defaults to 3,000 lines and is bounded at 10,000.
Images do not change the Windows wallpaper. xterm.js and node-pty/ConPTY load on
demand; shells do not start at Yami idle. The output bridge applies backpressure.
Windows Job Objects own the helper and shells so descendants are also reaped.
WSL selection, panes, SSH management and Terax's Ghostty GPU renderer are outside
this selected terminal scope; this is not full Terax parity.

## Agent sessions and decisions

Connect previews a CLI configuration diff, then applies only Yami hooks after
confirmation. Existing settings and unrelated hook entries remain intact. A
dated backup precedes replacement; changing the file after preview invalidates
the plan. Remove hooks uses the same preview flow. Restart the relevant CLI to
load changes. The relay is enabled when connecting; Workspace can pause it.

| Adapter | Installed by Yami | Decision behavior |
| --- | --- | --- |
| Claude Code | User settings command hooks | One-time permission Allow/Deny and AskUserQuestion answers. |
| Codex | User hooks.json | Permission response contract; CLI version must support these hooks. |
| Gemini CLI | User settings command hooks | Activity; approvals stay in the CLI. |
| Copilot CLI | User yami.json hooks, PowerShell/bash commands | Permission responses where supported by the CLI version. |
| Cursor | User hooks.json | Activity; approvals stay in Cursor. |
| OpenCode | Generated user plugin | Activity; approvals stay in OpenCode. |

Sessions distinguish idle, thinking, working, waiting, finished, error and
disconnected. The island reuses Yami's active-work pose and pill. A return action
focuses a reported ancestor window where available, with an honest project-folder
fallback. It cannot promise a precise tab in an external terminal/editor.
Reported file paths can open a bounded tracked Git diff against HEAD.

The short-lived relay authenticates to a per-profile named pipe and checks the
server's Windows user. The UI must acknowledge displaying a pending request
within 1.2 seconds. Otherwise the CLI keeps control; no permission is silently
granted. Displayed requests expire after roughly 108 seconds. Replies preserve
the source agent's request format; they are independent of Yami's Gemini tools.

Optional transcript fallback watches local Claude/Codex logs only when enabled.
It reads bounded recent tails and labels the source as transcript. Inferred
waiting/finished states can be wrong and never grant permission. Fresh hook
events take precedence. No transcript is uploaded by monitoring.

## Subscription allowance

Usage has Codex, Claude, Cursor, Copilot, OpenCode Go, Grok and custom endpoint
readers. Each displays its actual source, fetch time, named windows/reset times
and fresh/stale/authentication/backoff/error/unavailable state. Missing values
remain unknown. These numbers are subscription quota, not inferred token cost
or API billing. Account access is read-only: Yami does not initiate sign-in,
refresh credentials, switch accounts or use reset credits.

The Usage page shows each limit as a meter with its percentage and reset time.
A limit with no value reads "Unknown"; it is never estimated from activity.

Codex uses a bounded `codex app-server` initialize/initialized/account-rate-limits
exchange. Choose its executable when discovery cannot find it. Claude reads its
existing CLI credential and compatibility-sensitive, unpublished OAuth usage API;
multiple `.claude-*` profiles can supply separate groups. Cursor reads its local
credential database; Copilot uses existing gh/environment credentials; OpenCode
Go reads the Go credential, separately from Zen; Grok accepts the exact trusted
issuer's unexpired credential. These provider-specific endpoints can change.
The custom endpoint accepts named `windows` with `usedPercent`/`resetsAt`, or
Claude-style utilization windows. Configure an HTTPS or local URL and optional
encrypted credential; redirects carrying credentials are blocked.

Manual refresh is the default. Optional five-minute background refresh covers
previously queried available readers. Allowance/reset alerts default off; alerts
use 90% used or successive fresh reset evidence, never a stale/startup guess.
Provider retry deadlines are honored. Claude successful reads have a five-minute
floor (including failures). Real signed-in account/CLI-version compatibility remains unverified on
this machine; fixture data is not a successful account read.

## Connections, local models and MCP

Service connectors are opt-in and read operational status. GitHub shows own open
PRs/checks and requested reviews; Vercel shows deployments; n8n reads execution
status from the chosen server; Notion searches accessible pages; Cal.com lists
upcoming bookings; Resend shows email delivery; Stripe shows charges. Open links
to act in the source service. Yami does not send email, charge customers or
publish deployments through these connectors. Tokens need the service's relevant
read permissions. n8n requires its server URL.

Connections default to manual refresh. Explicit background refresh defaults to
300 seconds (60–3,600 seconds configurable), deduplicates concurrent requests
and backs off on rate limits. Initial data does not trigger a change alert.
Disabled or removed connections stop scheduling. Existing in-flight HTTP work
has a 15-second bound and is ignored if the connection is disabled/changed.

Local model server supports OpenAI-compatible `/models` and streamed or JSON
`/chat/completions`, model selection, cancellation and hiding `<think>` content.
Default URL is `http://127.0.0.1:11434/v1`. Yami does not launch/download a model.
This separate single-prompt text surface does not route Gemini voice/tools or
subscription credentials into another provider. Disconnect clears its key/model.

MCP is an optional HTTP Streamable MCP client: initialize, discover tools, inspect
JSON input and confirm each advertised tool call in Yami. Tools do not become
automatic assistant tools. HTTP SSE/JSON responses are bounded. Stdio servers,
OAuth account setup, a connector marketplace and remote mobile relay are not
implemented. Use trusted servers; confirmed MCP tools may have side effects.

## Dictation, notes and selected context

The Dictation page offers three engines: Gemini, Windows offline and Whistle offline. Picking Whistle turns on the Offline dictation module and downloads the Needle engine and Whistle model (about 18.5 MB, pinned SHA-256); a row shows progress, a Try again button after a failure, and a check mark when ready. Meeting recordings use the same engine on five-minute WAV segments. Yami runs it with English forced (`--audio-language en`) and the words from **Your words** as `--audio-keywords`, flags taken from the pinned runner's own `--help`. On Windows on 2026-10-28, `scripts/verify-whistle.mjs` downloaded both files through Yami, synthesized a sentence with Windows' own voice (no microphone), and dictated it into Yami's own chat box: "Please open the terminal and show me the weather for tmrw." (a Your words entry turned *tomorrow* into *tmrw*), about 1 second for the whole dictation. The runner alone answered a 5-second clip in 384 ms (118 ms to the first token) and peaked at about 42 MB working set (38 MB private) before exiting. The runner prints JSON with `text`; plain text is accepted too. Live streaming (`--audio-stream`) exists in the runner and is not used yet.


Choose Gemini (default) or an installed Windows speech recognizer in Dictation.
Windows transcription accepts 16 kHz mono PCM WAV, stays local and needs a
recognizer installed in Windows. It uses System.Speech, not a bundled Whisper
model. Dictionary rules replace whole words/phrases with Unicode boundaries.
Spoken snippets replace an entire utterance; they never execute its text.
Optional per-app natural/polished cleanup sends dictated text to Gemini only for
apps explicitly configured; verbatim is the default. Copy last dictation is local.

Notes stores and searches plain text locally. Explicit meeting recording can use
the microphone, Windows system audio or both, after acknowledging participant
awareness. PCM streams into a bounded temporary file; stop transcribes in
five-minute chunks. Provider/save failures retain audio for retry while the view
remains open. Discard, closing the owner window or quitting removes temporary
audio; quitting warns while recording/transcription is pending. Do not treat
temporary audio as crash recovery or durable recording storage. Gemini sends
audio to Google; Windows speech stays local. Summarize with Gemini is separate
and explicit. Checklist proposals can be added individually to Desk. Save the
note after editing or generating a summary. No proposed action runs automatically.

Attach chosen text/code files, tracked Git diffs, a terminal selection or selected
accessible window text. Preview the content first. Nothing is submitted until
the user sends chat. Private/password-window exclusions are heuristic. Individual
items expire after an hour and are bounded; a message plus up to five attachments
must fit 20,000 characters. Binary files are rejected.

Recap counts local agent phase changes over the last seven days. Retention is
seven days by default, up to 90; zero disables retention. It does not estimate
productive hours, cost, tokens or quality from activity.

## Verification and remaining gaps

On 2026-10-18, source and unpacked packaged Windows builds passed real PTY state,
resize, Ctrl+C, native relay Allow/Deny, visible-card ACK, descendant cleanup and
fixture-chat preservation. Contract tests cover named-pipe authentication,
fallback/questions, configuration merging, quota semantics, local HTTP/MCP,
credential validation and recording failure/retry/commit. Offline speech passed
using synthesized WAV audio and the installed recognizer. The browser fixtures passed
all 17 screens and all nine AI subsections without external requests before the
file wheel was merged. The preview now has 19 screens (adding File wheel and
Background). That run has not been repeated after the merge.

The Nightglow redesign of these pages (2026-10-18) changed presentation only. Its
checks are in the [verification history](reference/verification-history.md). It has
not been run in the packaged Windows app. The AI workspace and terminal screenshots
were regenerated from synthetic preview fixtures with `capture-workbench.mjs`.

Live provider accounts, live service credentials, each installed agent release,
microphone quality and system-audio capture across devices have not been tested.
Neither full upstream parity nor release readiness is claimed. Source revisions,
licenses and initial scope remain in the [adaptation review](research/adaptation-review.md).
See [performance](performance.md) for measured memory and its unmet target.
