# Desktop adaptation review: Coucou, Terax AI and CodeNotch

Reviewed 2026-10-17. This is a source-based feasibility review and a proposed expansion plan, not shipped functionality or a runtime certification of the upstream apps. No upstream installer, build, hook or application was executed, and no account credentials were inspected. Mobile applications, phone pairing and relay infrastructure are outside scope.

Apply the [adaptation rules](../adaptation.md): preserve each selected feature's operating behavior while reusing Yami's interface. Selecting a feature does not commit Yami to reproducing the source application's entire product.

## Source revisions and boundaries

| Repository | Pinned revision | Source examined | License observed |
| --- | --- | --- | --- |
| [Coucou](https://github.com/Louis-CFM/coucou) | `434d6a2b4af2e5ce117fa425170abe25620130b9` | Windows hook transport, agent installers and normalization/replies, service integrations, local-model connection, session-window targeting and Codex quota reader; Mac integration documentation and plan-gauge/poller code as cross-platform references. | Root code: MIT. `LICENSE-ASSETS.md` separately reserves Coucou/Mochi branding, character, icons, sounds and media. |
| [Terax AI](https://github.com/crynta/terax-ai) | `1a68067c22d2c42fce9bccfc1ea4e4a22ddfdd30` | PTY lifecycle, queues and output transport, shell/agent integration, terminal pane, background-image layer, AI/security architecture and resource reports. | Apache-2.0 at root. Bundled/adapted terminal components have their own provenance and notices to inspect before reuse. |
| [CodeNotch](https://github.com/vinzdg/codenotch) | `9e7cd3d486734d35dfce8d5a5401cd9b743a8fea` | Windows Claude/Codex usage adapters, activity hooks, transcript fallback, snapshot states, reset detection and auth handling; selected Swift quota/custom-endpoint adapters. | MIT in the root and Windows port. Third-party glyphs/vendor assets still need file-level provenance checks. |

Both Coucou and CodeNotch include Rust/Tauri Windows implementations. Yami can adapt their behavior into Electron/main-process/native modules without adopting Tauri or their visual systems. Source review establishes feasibility, not Yami performance or universal CLI compatibility.

## Proposed Yami presentation

| Existing Yami surface | Proposed extension | Reused presentation |
| --- | --- | --- |
| Island activity card and utility drawer | A compact AI tab for active sessions, attention requests and quota summaries. | Existing utility tabs, status pills, Phosphor icons, gold selection and captions. |
| Main bottom dock | An AI section when expanded content warrants it: Sessions, Usage and Connections as subordinate views. | The existing dock button/selection behavior and established page/settings layouts. |
| Settings | Connections, agent-hook setup, terminal appearance and configurable terminal shortcut. | Existing settings groups, rows, toggles, key fields, shortcut recorder, errors and dialogs. |
| App/launcher actions | Open Yami Terminal and return to a selected agent session. | Existing launcher discovery/action patterns and main-process window handling. |
| Dedicated terminal window | A real terminal surface with Yami chrome and an optional dimmed, blurred starter/custom background. | Yami's title bar, controls, spacing and colors. A monospace terminal text grid serves shell content; the surrounding UI keeps Rubik. |

These are proposed placements, not a new visual system. Avoid packing every connector into the collapsed notch. It should show the most relevant activity or attention state; the drawer/main app carries detail.

## Terax: the requested terminal is feasible

Yami currently exposes a confirmed advanced PowerShell tool, not an interactive terminal. Appending command output to a text panel would not deliver the terminal behavior requested here.

Terax's [PTY session model](https://github.com/crynta/terax-ai/blob/1a68067c22d2c42fce9bccfc1ea4e4a22ddfdd30/docs/architecture/pty-shell-integration.md) gives a useful contract: open a persistent shell, stream output, write ordered input, resize, deliver exit/error state and release the session. Its [Windows session implementation](https://github.com/crynta/terax-ai/blob/1a68067c22d2c42fce9bccfc1ea4e4a22ddfdd30/src-tauri/src/modules/pty/session.rs) serializes ConPTY creation/teardown, tracks child ownership, and handles cleanup when the frontend disappears. These are important adaptation targets, not incidental plumbing.

For Yami, I recommend:

1. Open the terminal from Yami and a user-assigned global shortcut. Reuse the existing shortcut recorder and expose conflict/registration errors; do not silently take an occupied shortcut.
2. Create the renderer and PTY only on first use. Prefer PowerShell 7 when installed, with Windows PowerShell/cmd alternatives. Start with an explicitly scoped local terminal; WSL, splits and restored layouts can follow if requested.
3. Keep PTY ownership behind validated main-process IPC. Compare `node-pty` in Electron with a focused ConPTY native module before selecting the bridge. The former adds native-addon rebuild/packaging work; the latter adds native lifecycle/streaming work. [Microsoft's ConPTY documentation](https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session) explicitly covers bidirectional pipes, resize and teardown; [node-pty](https://github.com/microsoft/node-pty) supplies a Node integration route.
4. Use one existing Yami starter wallpaper by default, with a dim overlay and a small configurable blur. Offer follow-Yami/custom/none, opacity and blur through existing settings controls. Choosing a terminal background must not call the desktop-wallpaper apply action. Terax's [background layer](https://github.com/crynta/terax-ai/blob/1a68067c22d2c42fce9bccfc1ea4e4a22ddfdd30/src/modules/theme/SurfaceLayer.tsx) separates the image layer from terminal content; reuse that separation rather than its component styles. Static images are the initial scope.
5. Bound scrollback, input/output queues and rendering work. Hidden terminals must continue commands and drain output without repainting continuously. Hiding and ending a session are different actions; an explicit close must account for running jobs rather than silently abandoning them.
6. Keep user-typed terminal input distinct from AI tool execution. Adding a manual terminal must not enable `run_terminal`, remove its confirmation, or let a model silently inject commands.

### Renderer decision: do not follow the README blindly

The pinned README still lists xterm.js, while [the actual terminal pane](https://github.com/crynta/terax-ai/blob/1a68067c22d2c42fce9bccfc1ea4e4a22ddfdd30/src/modules/terminal/TerminalPane.tsx) uses Ghostty-backed sessions and WebGL/WebGPU choices. The [renderer v2 document](https://github.com/crynta/terax-ai/blob/1a68067c22d2c42fce9bccfc1ea4e4a22ddfdd30/docs/architecture/terminal-renderer-v2.md) records macOS verification with Windows/Linux hardware verification pending. Its [resource figures](https://github.com/crynta/terax-ai/blob/1a68067c22d2c42fce9bccfc1ea4e4a22ddfdd30/docs/architecture/ghostty-resource-efficiency.md) are also macOS measurements, not transferable Windows guarantees. The README's disk size is not resident RAM.

Use a bounded Windows renderer comparison: a focused [xterm.js](https://xtermjs.org/docs/) integration versus the current Terax/Ghostty path, if its extra features justify the complexity. Choose by interactive CLI compatibility, accessibility, IME, fractional-DPI rendering, idle CPU, memory return and packaging. Neither is a measured Yami decision yet. Importing Terax's editor, source-control UI, browser panes and AI workspace would exceed this terminal scope.

The terminal parity checks must include persistent `cd`/environment, Ctrl+C, multiline paste, Unicode/IME, selection/copy, resize during output, full-screen alternate-buffer TUIs, large-output backpressure, exit codes and process cleanup after close/crash. Test real Claude/Codex CLI interfaces where installed. Measure the complete Electron + helper + shell + agent process tree before calling it lightweight; no memory number is promised by this review.

## Coucou: the strongest companion expansion

### 1. Agent sessions and useful activity

Adapt a session registry with agent, project, session identity, phase, current tool/file, timestamp and terminal target. Show thinking, working, waiting for a decision, finished, error and disconnected as distinct states. Reuse Yami's activity card and character's existing states instead of reproducing Mochi or adding permanently animated mini-characters.

Coucou's [Windows agent installers](https://github.com/Louis-CFM/coucou/blob/434d6a2b4af2e5ce117fa425170abe25620130b9/windows/src-tauri/src/agents.rs) and [relay normalization](https://github.com/Louis-CFM/coucou/blob/434d6a2b4af2e5ce117fa425170abe25620130b9/windows/hook/src/normalize.rs) cover different agent hook formats. This is a much better basis for activity than looking for a process named `claude.exe`: a process can exist while idle or awaiting input. Initial adapters should cover Claude Code and Codex, then Gemini CLI/OpenCode/Copilot as their installed-version protocols are verified.

Add an open-session action using Yami-owned terminal session IDs where possible. For external terminals/editors, Coucou's [session-window targeting](https://github.com/Louis-CFM/coucou/blob/434d6a2b4af2e5ce117fa425170abe25620130b9/windows/src-tauri/src/session_window.rs) provides an ancestor/window approach, with documented cases that cannot resolve exactly. Display an honest folder/editor fallback rather than claiming to focus a precise tab when only its window can be found.

### 2. Approvals and questions that actually reach the agent

Use Yami's existing confirmation/dialog patterns, but preserve request/session IDs, agent-specific reply formats, timeouts, duplicate protection and terminal fallback. This is separate from Yami's own Gemini-tool confirmation channel.

Coucou's [pipe protocol](https://github.com/Louis-CFM/coucou/blob/434d6a2b4af2e5ce117fa425170abe25620130b9/windows/src-tauri/src/pipe.rs) waits for the UI to acknowledge displaying a card before waiting for a human decision. Its [reply adapter](https://github.com/Louis-CFM/coucou/blob/434d6a2b4af2e5ce117fa425170abe25620130b9/windows/hook/src/reply.rs) supports approvals only for named agent families and falls back to the terminal without manufacturing permission. Preserve those guarantees. Test both Allow and Deny against the actual CLI; a notification alone is not approval support.

The generic `docs/AGENTS.md` contains older claims about unsupported Codex sessions/third-party approvals that differ from the current Windows source. Treat the implementation and adapter-specific tests as evidence to investigate, not a universal promise that every agent can answer questions or approvals. Persistent “always allow” rules are not an initial recommendation; they would need separate scope and Yami policy treatment.

### 3. Connections to services and local model servers

These are separate connection types: service APIs provide operational data; a local/OpenAI-compatible model server provides inference; agent hooks provide activity/decisions. Coucou's service integrations are concrete API adapters, not evidence of a universal MCP connector marketplace.

| Candidate | Useful Yami behavior | Priority and limit |
| --- | --- | --- |
| GitHub | PRs, reviews requested, CI failures and a link to the relevant item. | First connector; start with read-only status and navigation. |
| Vercel | Deployment running/ready/failed, project and deployment link. | First group; no automatic deployment action. |
| n8n/self-hosted workflow server | Workflow completion/failure and execution details. | First group if used; server URL and credentials must be explicitly configured. Retry is a separate action, not a side effect of viewing. |
| Notion | Recent/relevant pages and search/open navigation. | Later; edits are a separately scoped capability. |
| Cal.com | Upcoming bookings and event links. | Later; booking changes require a distinct action path. |
| Resend | Email delivery/failure events. | Later; sending email would change Yami's current no-send policy and is outside this proposed read-only connector. |
| Stripe | Payment/status notifications and configured account summaries. | Optional, lower priority for Yami; no payment, refund or transfer actions. |
| Ollama / LM Studio / custom model server | Connect, discover supported chat models, stream a reply and report server errors. | Useful alongside the provider-adapter roadmap; Yami need not start or keep a model resident. |

The service behavior comes from [Windows integrations](https://github.com/Louis-CFM/coucou/blob/434d6a2b4af2e5ce117fa425170abe25620130b9/windows/src-tauri/src/integrations.rs). Local inference is implemented separately in [local_chat.rs](https://github.com/Louis-CFM/coucou/blob/434d6a2b4af2e5ce117fa425170abe25620130b9/windows/src-tauri/src/local_chat.rs), including credentials bound to their configured server address. An authenticated server address change must not silently send the old key to a different host.

For agent events, prefer a local, per-user Windows named pipe with bounded payloads, deadlines and verified peer identity. Coucou's [Windows relay](https://github.com/Louis-CFM/coucou/blob/434d6a2b4af2e5ce117fa425170abe25620130b9/windows/hook/src/win.rs) verifies the pipe server's user before sending. A generic network listener is not required for desktop agent monitoring. An MCP client could be a later, separately designed adapter type; it is not the same thing as either a hook server or a chat endpoint.

Coucou starts service refresh loops at differing cadences (for example n8n 15 seconds, Vercel 30 seconds and GitHub's base loop five minutes), skipping network work when disabled/paused. Do not transplant all timers into Yami. Start/stop configured adapters explicitly, coalesce requests, use refresh-on-open and supported events where they preserve the selected behavior, and define any required background-notification freshness before implementation. Replacing live notifications with manual refresh would be a functionality change, not automatic parity.

Hook setup should show its config changes, preserve unrelated entries, back up before writing, detect changes since preview, and support removal of only Yami-owned entries. The current review has not installed hooks or changed any agent settings.

### 4. Further desktop ideas worth considering

| Idea | Fit for Yami | Remaining work |
| --- | --- | --- |
| File-change ticker and small diff view | Open details from the existing activity pill; show edited file and additions/deletions. | Bounded file reads, binary/large-file handling, correct session/project ownership. |
| Explicit file/window context attachment | Extend Yami's composer/selection chips to selected files or terminal output. | Clear user selection, content limits and provider disclosure; no passive upload. |
| Dictation dictionary, replacements and spoken snippets | Reuse settings rows and existing snippets/dictation. | Preserve original-target insertion and clipboard behavior; verify language matching and correction order. |
| Local activity recap | Sessions, projects, completed work and time in a local summary. | Accurate event definitions and opt-in retention, not inferred productivity claims. |
| Local/offline speech | Optional complement to Gemini dictation. | Coucou's Mac Parakeet/Apple path is not a Windows drop-in; benchmark an actual Windows engine/model and its unload behavior. |
| Meeting notes/transcripts | Could feed notes and Desk to-dos. | Separate microphone/loopback capture, recording consent, retention and substantial model/resource work; defer. |
| Per-app dictation cleanup | User-chosen formatting for code, messages or prose. | Optional provider/local inference, permission and application-target tests. |

These latter items are directions from Coucou's desktop feature set, not completed Windows parity findings. Yami already has dictation, captions, memory, media and roaming; improve those paths instead of importing duplicate systems. Portfolio tracking, mail sending and a full workspace IDE are poor first additions to this companion's current scope.

## CodeNotch: usage and account state

### What to preserve

The useful abstraction is a provider/account snapshot with one or more named quota windows, used fraction, reset time, fetched-at time and status. Keep unknown, fresh, stale, authentication-required, rate-limited and failed distinct. Usage percentages, approximate token-cost estimates, balances and agent activity are different measurements; do not merge them into one invented number.

The [Windows usage model](https://github.com/vinzdg/codenotch/blob/9e7cd3d486734d35dfce8d5a5401cd9b743a8fea/windows/codenotch/src/usage.rs) records these states, optional grouping, derived values and backoff. The [reset watcher](https://github.com/vinzdg/codenotch/blob/9e7cd3d486734d35dfce8d5a5401cd9b743a8fea/windows/codenotch/src/reset_watch.rs) requires successive fresh observations and suppresses startup/stale/duplicate reset notifications. This logic fits Yami's existing caption/notification surfaces better than importing CodeNotch's ring-based UI.

Proposed AI Usage view: provider/account rows, published limit windows and reset times, last refreshed/source, refresh/sign-in/open-client actions, optional low-allowance/reset alerts, and a separate activity badge. Use the existing settings/list typography and controls. Account credentials remain owned by the relevant CLI where possible; the renderer receives safe metadata, never tokens.

### Provider feasibility and honesty

| Provider/path | Upstream evidence | Recommendation for Yami |
| --- | --- | --- |
| Codex | [CodeNotch adapter](https://github.com/vinzdg/codenotch/blob/9e7cd3d486734d35dfce8d5a5401cd9b743a8fea/windows/codenotch/src/codex.rs) tries live usage, bounded native-client recovery, then timestamped rollout data. [Coucou's reader](https://github.com/Louis-CFM/coucou/blob/434d6a2b4af2e5ce117fa425170abe25620130b9/windows/src-tauri/src/codex_plan.rs) directly asks `codex app-server`. | Start with the documented native-client `account/rateLimits/read`, use the `codex` bucket where supplied and render additional buckets separately. Do not substitute an unrelated quota bucket for missing core data. Reuse the existing sign-in; bound and reap the owned process. |
| Claude Code | Windows reads Claude's credential store and usage endpoint; the Swift adapter additionally prefers CLI/desktop-cache paths. | Feasible but compatibility-sensitive. The source explicitly acknowledges the OAuth usage endpoint is not a published API. Validate the installed CLI/cache route on Windows; show unavailable/stale honestly. Do not copy background token-renewal commands without separately establishing their effects. |
| Cursor / Copilot / OpenCode and others | The Windows README documents provider-specific stores, endpoints and fallback behavior; Mac has a broader provider set. | Add adapters one at a time with real Windows checks. A provider shown in the Mac table is not proof of Windows parity. OpenCode Go quota is not Zen credit; provider names/keys are not interchangeable. |
| Custom usage endpoint | [Swift custom endpoint adapter](https://github.com/vinzdg/codenotch/blob/9e7cd3d486734d35dfce8d5a5401cd9b743a8fea/Sources/Providers/CustomEndpointProvider.swift) recognizes particular usage schemas and blocks redirects carrying credentials. | Optional future schema adapter, with explicit URL/auth binding. An OpenAI-compatible chat endpoint does not imply it offers subscription usage. |

[Official OpenAI app-server documentation](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt) confirms the quota read/updated surfaces, per-window durations/resets and multi-bucket replies. Prefer that documented surface over coupling Yami to `chatgpt.com/backend-api/wham/usage`. Do not consume reset credits, initiate login, change accounts or run inference as a side effect of displaying usage. Those are different actions. Subscription quota monitoring does not itself authorize routing Yami's chat through that subscription.

CodeNotch's [transcript watcher](https://github.com/vinzdg/codenotch/blob/9e7cd3d486734d35dfce8d5a5401cd9b743a8fea/windows/codenotch/src/watcher.rs) is a useful fallback, but its waiting/done inference can mistake a slow tool for a permission wait. Show that source/confidence and prefer fresh hooks. Its periodic rescans and quota loops need an explicit Yami scheduling design rather than wholesale copying.

## Recommended implementation order

1. **Shared session/event foundation and read-only AI view.** Establish agent/session identity, phases and safe summaries; add installed/not-installed and connected/disconnected states. This supports every later feature.
2. **Yami Terminal.** Configurable launch shortcut, real ConPTY shell lifecycle, bounded buffers and Yami background settings. Verify renderer/bridge choice on Windows before expanding to WSL or splits. This is the requested product feature with the largest new native/runtime surface.
3. **Codex and Claude usage adapters.** Codex's documented native path first; validate Claude's actual source behavior and failures. Add fresh/stale/reset semantics before alerts.
4. **Agent approvals/questions and precise return-to-session actions.** Start with individually verified adapters and preserve terminal fallback. Never infer authorization from an activity event.
5. **Read-only GitHub, Vercel and n8n connections.** Add enable/disconnect/refresh behavior, credential binding and notifications with an agreed freshness budget. Broaden providers or services only after the adapter contract is working.
6. **Context attachments, diff details and dictation improvements.** Reuse the established companion flows; local speech/meeting recording remains later research.

This review originally proposed these phases. The subsequent development
implementation is recorded in [AI workspace and terminal](../workspace.md),
including selected scope, Windows/package checks and remaining account,
agent-version and device gaps. Neither document claims full upstream parity.
