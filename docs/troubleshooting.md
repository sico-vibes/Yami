# Troubleshooting

Find your problem below. If none of these help, see [Logs and reporting a bug](#logs-and-reporting-a-bug).

## Windows says Yami is unsafe or unknown

Yami is not signed with a publisher certificate, so Windows SmartScreen may warn you the first time you run it.

1. Select **More info**.
2. Select **Run anyway**.

Only do this for a copy you downloaded from the project's release page. Some security software also flags Yami's file wheel, because it uses a keyboard and mouse hook and is not signed. If that happens, add an exception for Yami in your security software.

## Voice or dictation does not start

- **Check Windows microphone permission.** In Windows Settings, make sure apps are allowed to use the microphone.
- **Check the microphone.** Open **Settings > System > Microphone** and choose your microphone, or leave it on the Windows default.
- **Check your internet connection.** Gemini voice and Gemini dictation need one.
- **Check your Gemini key.** Voice needs a connected Gemini key. Whistle offline and Windows speech do not need the internet, but Windows speech needs a recognizer installed in Windows.

## Dictated text does not appear

- Click into a text box before you hold **Ctrl + Win**. Yami types into the box that had focus when you started.
- Password fields are never typed into.

## A shortcut does not work

- Open **Settings > Shortcuts** and make sure **Enable shortcuts** is on.
- Another program may use the same keys. Change the shortcut in **Settings > Shortcuts**.
- Make sure Yami is running. Look for the island at the top centre of the screen, or the Yami icon in the tray.

## The Gemini key is rejected

- Copy the key again from Google AI Studio and paste the whole key, without extra spaces.
- Check that the key is still active in your Google account.
- Check whether Gemini is available in your country and to your account. Yami can only use models your account is allowed to use.

## An administrator prompt was declined

Nothing changes. Yami only changes things after you approve the Windows administrator prompt. To try again, start the same action in Yami. The prompt appears again.

## A Tune change did not apply

- Check whether you approved the Windows prompt. A prompt left unanswered for two minutes cancels the change.
- Some tweaks only take effect after Explorer restarts. Use **Restart Explorer** when Yami offers it.
- Use **Put back** to restore a changed value.

## A feature is missing

Most features belong to a module that is turned off. Open **Settings > Modules** and turn on the module. The AI tab, the Tune tab and the Inbox only appear when their module is on. See [modules](modules.md).

## Brightness is not available

Yami changes brightness through Windows' monitor controls. Many external monitors do not support it. Laptop screens usually do.

## A plan did not run while the PC was asleep

Windows decides whether it can wake a sleeping PC, based on its power settings and hardware. Yami checks for missed plans when it starts again, and it runs them then. A PC that is shut down cannot run plans.

## Yami Remote does not connect from my phone

- Make sure the phone and the PC are on the same home network.
- Make sure **Yami Remote** is on in **Settings > Modules**.
- Allow Yami through the Windows firewall when Windows asks, on private networks.
- Scan the pairing code again. If a phone was paired before, **New pairing code** in **Settings > Phone** unpairs every phone.

Yami Remote works only on your home network. Use a VPN, such as Tailscale, to reach it from elsewhere.

## Spotify controls do not work

Spotify requires a Premium account for the extra controls. Some of them also need Spotify to be playing on a device that Spotify can see. Basic play, pause and skip work through Windows, without Spotify's developer app.

## A helper download failed

- Check your internet connection, then press **Try again** in **Settings > Modules**.
- Yami shows the reason on the card. If a download keeps failing, use **From file** with a copy you downloaded yourself.
- LibreOffice is never downloaded by Yami. Slide conversions need it installed.

## A file conversion failed

Yami shows the reason with the failed job. Common causes are a missing helper program, an unsupported format, or a file that is in use. Try again after the helper is ready, or close the file in the other program.

## Yami uses too much memory

Yami's idle memory use depends on which modules are on. Turn off modules you do not use, and turn off **Living flame** if it is on. See [the FAQ](faq.md) for typical numbers.

## Start fresh

To reset Yami, first export your data if you want to keep your chats and settings. Then go to **Settings > Your data**, press **Delete all my data**, and confirm.

This erases your local data and your API keys, and it cannot be undone. You will need to connect your Gemini key again.

To reset only one thing, change its setting back, or delete that item, such as a memory.

## Logs and reporting a bug

Yami keeps a small log of what it does, so problems can be found and fixed. Nothing in the logs leaves your PC unless you share it.

**Where the logs are.** Settings › Your data › **Logs folder** › Open. There is one file a day for each kind of log, kept for a week:

| File | What it holds |
| --- | --- |
| `.LOG` | What Yami did: starting, slow or refused actions, windows that stopped responding. |
| `.ERR` | Errors, with the technical details a developer needs. |
| `.TRG` | One entry for each distinct problem, with what happened just before it. |
| `.DEG` | Extra detail, written only while **Debug logging** is on. |

API keys, tokens and passwords are masked, and your user folder is shown as `~`. Yami never writes your conversations, dictation or file contents into the logs.

**Reporting a bug.**

1. If you can make the problem happen again, turn on Settings › Your data › **Debug logging**, do it once more, then turn it off.
2. Choose **Report a bug**. Yami saves a report file (it ends in `.CLT.md`), shows it in File Explorer, and opens a new issue on GitHub.
3. Describe what happened, and attach the report file. Open the file first if you want to see what it contains.

**Asking a coding agent for help.** The report is written so that AI coding agents can read it: give the `.CLT.md` file to your agent. If you use **Yami for your agents** (see [AI and agents](features/ai-and-agents.md)), you can also switch on the tools that let an agent read Yami's status and logs, open Yami's pages, take a picture of Yami's own windows, and change a setting. Every setting change asks you first.
