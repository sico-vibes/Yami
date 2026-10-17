# Getting started

This guide gets the Windows app running, adds a Gemini connection, and exercises a first voice or text request. The five-minute, one-task-at-a-time progression is inspired by the structure of the [Paperclip Quickstart Path](https://docs.paperclip.ing/guides/getting-started/five-minute-path/), not by Paperclip’s product or implementation.

## Requirements

- Windows 10 or 11 on a desktop session. Windows Settings, accessibility APIs, installed apps, audio controls, and some hardware features are needed for native actions.
- Node.js and npm for source development. The release package is a Windows portable executable.
- A microphone and internet connection for voice and provider-backed AI features.
- Your own Google AI Studio/Gemini API key to use conversation, dictation, screen vision, or Gemini tool calls. Yami does not include a shared key.
- Optional Tavily API key for current web research and multi-query deep research. Without one, Yami uses Wikipedia’s public search API for basic results.

Provider account access, pricing, model availability, usage limits, and free-tier eligibility vary by geography and change over time. Review provider terms and account usage before connecting a key. A free account or free quota is not a promise of unlimited use.

## Run a release build

Download the Windows portable package from the release page when releases are published. Start `Yami <version>.exe`; no installer wizard is required by the configured portable target. Windows may display security prompts for unsigned development builds. Confirm the publisher and download source before running a build.

## Run from source

In PowerShell, from the repository root:

```powershell
npm install
npm run dev
```

The development command starts Vite and Electron plus the Windows native host. A full production build uses `npm run build`; package creation is `npm run package`. See [Development and release](development.md) for what each command does and which checks are Windows-only.

The web preview command is `npm run preview:web`. It uses a fixture bridge to render the UI in a browser for layout and interaction work. It cannot perform real Windows integration, microphone or screen capture, provider calls, schedules, or power actions.

## Connect Gemini

1. Open **Settings → API keys → Gemini API key → Connect**.
2. Use **Get an API key** to open [Google AI Studio](https://aistudio.google.com/api-keys) in your browser, create or select a key, then paste it into Yami’s password field.
3. Choose **Save and start**. Yami validates the key by asking Google’s Gemini API for the models available to that account. The key is encrypted by Windows-backed Electron `safeStorage` before it is written locally.
4. Ask a short question in the home screen or hold the voice shortcut. The current source defaults to `gemini-3.8-flash` for text and `gemini-3.8-live` for realtime voice, subject to account access. If those models are not returned for your key, setup picks a compatible model from the provider’s model list.

Do not paste a key into a terminal, issue, screenshot, prompt, or source file. The UI does not display the saved key again. You can replace or forget it in settings.

## Optional: connect Tavily

Open **Settings → API keys → Tavily API key → Connect** and paste your own Tavily key. Yami validates it against the Tavily usage endpoint and displays usage returned by the account. The UI currently describes a free monthly credit allocation, but account plans, location eligibility, quotas, and pricing are controlled by Tavily and may change. Check [Tavily’s current plans](https://tavily.com/#pricing) and account page before use. Deep research runs only when explicitly requested and can consume several credits per question.

If no Tavily key is connected, basic research uses Wikipedia’s search API. A result may be missing, stale, or too short for a detailed answer; Yami cannot promise coverage.

## Try a workflow

- Hold **Win + Alt**, speak, and release to finish a voice turn.
- Hold **Ctrl + Win** to dictate into the field that had focus when you began. The resulting text is inserted into that original field.
- Hold **Ctrl + Shift**, draw around a screen region, and ask about it. The screenshot is sent to Gemini when a key is connected; without one it remains a local selection in the console.
- Press **Win + A** to open the app/file/snippet launcher.
- Scroll down on the island to open the utility panel; choose Controls, Today, Stats, Clipboard, Apps, Wallpaper, or Power.
- Close the main window to leave Yami running in the tray. Choose Quit Yami from the tray to exit.

Shortcuts can be rebound in **Settings → Shortcuts**. Use Escape to cancel a shortcut capture, active recording, or screen selection. See [Features and settings](features-and-settings.md) for full behavior and limits.

## First-run privacy choices

Yami stores conversations, settings, tasks, and saved memories in the local Windows app-data folder. Gemini receives voice audio, dictated audio, selected screenshots, conversation turns, enabled memories, and (if enabled) context when needed for inference. Tavily receives research questions; returned source summaries are sent to Gemini for answer generation. See [Security and provider data flow](security-and-providers.md) before using AI features.

Clipboard history is enabled by default and retains copied text locally for 30 days, excluding pinned items from automatic expiry. Turn it off in **Settings → Your data** if that does not fit your use. Its exclusion checks are best effort, not a guarantee. Location and weather are off by default. M-Lab speed testing publishes results that include the public IP address and requires a separate confirmation each time.

## Troubleshooting

**Gemini key is rejected.** Check the key in Google AI Studio, account and regional availability, and that the model list is available to your account. Yami reports validation failures; it cannot enable a model that Google has not granted to the account.

**Voice does not start.** Check Windows microphone permission, the selected input device, internet access, and model access. In **Settings → System**, inspect the native connection and choose the Windows default or a listed microphone.

**Brightness is unavailable.** The native brightness path depends on monitor WMI support and commonly works on laptop panels, not every external monitor. Yami checks for support and verifies the observed setting before reporting a successful change.

**Scheduled work did not run while the PC slept.** A Windows waitable timer requests that the OS wake the PC while Yami is running. Hardware, firmware, power policy, and session state govern whether Windows honors it. Missed plans are checked when Yami resumes. A powered-off PC or secure lock/UAC desktop cannot run Yami actions.

**Web preview cannot perform an action.** The browser preview uses a fixture bridge and intentionally substitutes deterministic UI data. Use the Windows app to validate native behavior.
