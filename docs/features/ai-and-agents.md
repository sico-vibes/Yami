# AI workspace and agents

The AI workspace is for people who work with coding agents such as Claude Code, Codex or Gemini CLI. It shows what your agents are doing, lets you start them in your projects, and lets them ask you for permission in Yami. It also includes Yami Terminal, a built-in terminal.

Turn it on in **Settings > Modules > AI workspace**, or choose the Developer or Everything preset. The **AI** tab then appears in the dock and the island drawer. While it is off, the tab is hidden and Yami does not run any of its background work.

## Sessions

**Sessions** lists one card for each agent session that Yami can see. Each card shows the project, the agent's name, when it was last active, a status word (idle, thinking, working, waiting, finished, error or disconnected), and the latest detail.

- **Permission requests** appear in a dialog. Allow once or deny.
- **Changed files** open as chips. Select one to see its changes against Git's last commit.
- **Dismiss** removes a card.

Yami learns about agents through hooks that you install (see below). It can also read agent logs if you turn on transcript fallback, which is off by default.

## Projects

**Projects** keeps the folders you work in.

1. Press **Add** and choose a project folder.
2. Each card shows the folder, its Git branch, how many files changed, and how far it is ahead or behind its remote.
3. Use the tiles on a card to start an installed agent in that folder. Yami opens a Yami Terminal tab there and starts the agent.

Yami recognises these agents: Claude Code, Codex, OpenCode, Cursor CLI, Gemini CLI, Copilot CLI, Pi, Qwen Code, Amp, Aider, Crush and Goose. Yami starts only these commands. It never types a command you typed into a box.

Other buttons on a card open the folder in **Terminal here**, in File Explorer, or in your editor when VS Code or Cursor is installed.

**Forgetting a project never touches its files.**

**Check packages** reads a project's `package-lock.json` and checks the packages in it against the OSV vulnerability database. Only package names and exact versions are sent, and only when you press the button. Nothing is installed or changed.

### Parallel tasks

Parallel tasks let several agents work on the same project at once, each in its own copy.

- **New task** creates a Git worktree and a branch beside your project, then opens a terminal there with the agent you picked. Your own checkout stays untouched.
- **Fan out** sends one task to two to four agents. Write the task once. Each agent gets its own worktree and reads the task from a file that Git ignores.
- **Compare** puts two to four tasks side by side and shows what each one changed.
- **Remove** deletes a task's folder. Git refuses if the folder has changes you have not committed. The branch and its commits stay.

Each agent may ask whether to trust the new folder the first time it runs. Answer as you normally would.

### Mail catcher

Under **Projects**, the mail catcher is a small local mail server for testing the email an app sends.

- **Start** listens on `127.0.0.1` port 1025 only, so Windows does not ask about the firewall. It accepts any login and does not use encryption.
- Mail sent to it is saved on your PC and never relayed. The newest 500 messages are kept.
- Opening a message shows the sender, recipients, date, text and attachment names. Images, trackers and scripts are never loaded. **Open in mail app** opens the message in your mail program.
- **Stop** closes the port. Yami also stops it when it quits.

## Yami Terminal

Yami Terminal is a terminal window inside Yami. Open it from **Sessions**, from the island drawer's AI tab, or with the shortcut you set in **Settings > Workspace**.

- **Shells:** PowerShell 7, Windows PowerShell, Command Prompt, Git Bash and WSL. Choose a default in **Workspace** settings, or pick one for each new tab.
- **Tabs and panes:** add up to eight tabs. Split view shows up to four tabs at once.
- **Find:** press **Ctrl + Shift + F** to search the scrollback.
- **Copy and paste:** **Ctrl + Shift + C** and **Ctrl + Shift + V**. **Ctrl + C** still interrupts.
- **Links:** **Ctrl + click** opens a web address in your browser or shows a file in File Explorer.
- **Command status:** the footer shows the folder and how the last command ended. **Ctrl + Up** and **Ctrl + Down** jump between commands.
- **Servers:** the plug button lists the network ports that this tab's programs are listening on, with a button to open each in your browser.
- **Reopen last tabs:** tabs come back when you restart Yami. Only shells and their folders come back. Agents and SSH sessions are not started again.
- **SSH hosts:** hosts from `~/.ssh/config` appear in the shell menu when Windows OpenSSH is installed.

Closing the terminal window hides its sessions. **End session** stops that shell and everything it started. Quitting Yami stops all of them.

## Connect your agents

Connecting an agent installs a small set of hooks in the agent's settings, so the agent can tell Yami what it is doing.

1. Open **AI > Connections** and choose the agent.
2. Yami shows a preview of the change to the agent's settings. Nothing changes yet.
3. Confirm. Yami adds only its own entries, keeps your existing ones, and saves a dated backup first.
4. Restart the agent so it loads the change.

Remove hooks works the same way. Supported agents are Claude Code, Codex, Gemini CLI, Copilot CLI, Cursor and OpenCode. Claude Code and Codex can answer permission requests from Yami. The others keep their approvals in their own windows.

When an agent asks for permission, Yami shows a card. If Yami cannot show the card in time, the agent keeps control, and nothing is granted for you. A card you do not answer expires after about two minutes.

## Usage

**Usage** shows how much of your subscription allowance is left for Codex, Claude, Cursor, Copilot, OpenCode Go and Grok, as meters with reset times. You can also add a custom endpoint.

- Yami reads a provider only when you press its **Read** button, unless you turn on background refresh.
- It uses the sign-in your agent already has. It does not sign in, switch accounts or use reset credits.
- Allowance alerts are off by default.

These numbers are your subscription limits, not an estimate of cost.

## Connections

**Connections** links services with read-only status: GitHub, Vercel, n8n, Notion, Cal.com, Resend and Stripe. Each one uses a token you provide. Connections show status and open links to the service. Yami does not send email, charge customers or publish deployments through them.

## Yami for your agents

**Yami for your agents** lets agents reach Yami through the Model Context Protocol (MCP). It is off by default.

- Yami listens on this PC only, at `http://127.0.0.1:47821/mcp`.
- Requests need a secret token. Yami keeps it encrypted, and **New token** replaces it.
- Each tool has its own switch: **notify** (shows a message in Yami), **ask_user** (asks you a yes-or-no question), **list_projects**, and **open_terminal** (opens a terminal in a project and runs nothing).
- The MCP page shows the address and a ready `claude mcp add` command.

Yami does not change your agents' settings for you. Add Yami to an agent yourself.

## Dictation, notes and recap

- **Dictation** settings choose the dictation engine and hold your dictionary rules. See [voice and dictation](voice-and-dictation.md).
- **Notes** store plain text notes on this PC. You can record a meeting from the microphone, system audio or both. Yami asks you to confirm that participants know. Summaries and action items are optional, and nothing runs without you.
- **Recap** counts agent activity over the last seven days.

## Command palette

Press **Win + A** and type an agent's name followed by a project, such as `claude yami`. Yami starts that agent in a terminal tab in the project. See [utilities](utilities.md) for the rest of the launcher.

## What it needs

- The **AI workspace** module.
- The agent CLIs you want to use, installed on your PC.
- Your own tokens for subscription and service reads, if you use them.
- Administrator rights are not needed.

## Privacy

Agent activity stays on this PC. Changes to an agent's settings are previewed and backed up. Only the services you connect are contacted. Notes and meeting audio stay local, except that Gemini receives audio when you use Gemini transcription. See [providers and privacy](../providers-and-privacy.md).
