# Getting started

This page takes you from download to your first conversation with Yami. It takes about five minutes.

## What you need

- Windows 10 or Windows 11 (64-bit), signed in to a desktop session.
- A microphone, for talking to Yami and dictating. Typing works without one.
- An internet connection for AI features.
- A free Gemini API key from Google, for chat, voice and dictation. Yami does not come with a shared key. See [providers and privacy](providers-and-privacy.md).

Optional: a free Tavily API key for better web search.

## 1. Download and run Yami

1. Download the Windows portable file (`Yami <version>.exe`) from the project's release page.
2. Double-click the file. No installer is needed.
3. Windows may show a SmartScreen message because Yami is not signed with a publisher certificate. Select **More info**, then **Run anyway**.

Yami appears as an island at the top centre of your screen, and its icon sits in the Windows tray. Closing the main window keeps Yami running in the tray. To quit, right-click the tray icon and choose **Quit Yami**.

## 2. Choose your Yami

The first time you open Yami, a screen called **Choose your Yami** asks which features you want. Pick a preset:

| Preset | What it turns on |
| --- | --- |
| Essentials | Offline dictation, File wheel, Clipboard history, Roaming Yami |
| Developer | AI workspace, Offline dictation, File wheel, Feeds inbox, Yami for your agents, Clipboard history |
| Tinkerer | Offline dictation, Windows tune-up, File wheel, Clipboard history, Roaming Yami, Desk widget |
| Everything | All twelve features |
| Custom | Only the features you switch on |

You can change this at any time in **Settings > Modules**. See [modules](modules.md).

## 3. Connect Gemini

Gemini powers chat, live voice, dictation from the Gemini engine, and questions about your screen.

1. Open **Settings**, then choose **API keys**.
2. Next to **Gemini API key**, select **Connect**.
3. Select **Get an API key**. Your browser opens Google AI Studio. Create or select a key, then copy it.
4. Paste the key into Yami's field and select **Save and start**.

Yami checks the key with Google and picks a model your account can use. The key is stored encrypted on your PC and is not shown again. You can replace or remove it at any time.

Do not share your key in screenshots, chats or files.

## 4. Optional: connect Tavily for web search

Tavily gives Yami better results for current questions and deeper research.

1. Open **Settings**, then choose **API keys**.
2. Next to **Tavily API key**, select **Connect**, and paste your key.

Without a Tavily key, Yami uses Wikipedia for basic search. Tavily's plans, free allowances and country rules are set by Tavily and can change, so check its website before you rely on them.

## 5. Try your first requests

- **Talk to Yami.** Hold **Win + Alt**, say something, then let go.
- **Dictate text.** Click into any text box, hold **Ctrl + Win**, speak, then let go. The text appears in the box you were typing in.
- **Ask about part of your screen.** Hold **Ctrl + Shift**, draw a loop around anything, and let go. Yami answers about that part of the screen.
- **Open the launcher.** Press **Win + A** to search apps, files, snippets, units, currency and more.
- **Open the drawer.** Click the island at the top of the screen to see Controls, Today, Stats and the other tabs.
- **Use the file wheel.** Select files in File Explorer and press **Ctrl + Alt + Y**. Or drag a file and tap **Shift**, **Ctrl** or **Alt**.

Press **Esc** to cancel a recording, a screen selection or a shortcut capture.

## Change the shortcuts

Open **Settings > Shortcuts** to change them. The shortcuts are:

| Shortcut | What it does |
| --- | --- |
| Win + Alt (hold) | Talk to Yami |
| Ctrl + Win (hold) | Dictate into the text box you are using |
| Ctrl + Shift (hold, then draw) | Circle something on screen to ask about it |
| Win + A | Open the launcher |
| Ctrl + Alt + Y | Open the file wheel for files selected in File Explorer |

Turn off **Enable shortcuts** in **Settings > Shortcuts** if they clash with other programs.

## Next steps

- [Island and drawer](features/island-and-drawer.md) explains the notch and its tabs.
- [Voice and dictation](features/voice-and-dictation.md) explains how talking and dictating work.
- [Troubleshooting](troubleshooting.md) helps if something does not work.
