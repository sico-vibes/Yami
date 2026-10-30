# Modules

Every feature beyond the core island and chat is a module. A module is a switch that adds one feature to Yami. You can turn modules on and off at any time, and a module that is off does nothing: it runs no background work and opens no windows or ports.

## Choose your features

The first time you open Yami, **Choose your Yami** asks which modules you want. Pick a preset, or choose **Custom** and switch modules yourself.

| Preset | Modules it turns on |
| --- | --- |
| Essentials | Offline dictation, File wheel, Clipboard history, Roaming Yami |
| Developer | AI workspace, Offline dictation, File wheel, Feeds inbox, Yami for your agents, Clipboard history |
| Tinkerer | Offline dictation, Windows tune-up, File wheel, Clipboard history, Roaming Yami, Desk widget |
| Everything | All twelve modules |
| Custom | Only the modules you choose |

Each module card in setup explains what the module does, what permissions it uses, and any optional downloads.

## Change modules later

- **Settings > Modules** lists every module with a switch. It also shows whether each module is running right now.
- The tray menu has **Choose features…**, which opens the same setup screen.

Turning a module off closes its windows and stops its work. Your data stays. Turning it on again brings back what you had.

## The modules

| Module | What it adds | Optional downloads |
| --- | --- | --- |
| **AI workspace** | Agent sessions, projects, Yami Terminal, usage meters, connections, notes and recap. Adds the **AI** tab. | None |
| **Offline dictation** | Dictation with the Whistle model on your PC. No internet needed. | Whistle files (about 18.5 MB) |
| **File wheel** | Convert files and run tools from a drag gesture. | FFmpeg, ImageMagick, 7-Zip, 7-Zip extra, ExifTool |
| **Windows tune-up** | Tweaks, startup apps, DNS, network shield, cleanup, disk space and more. Adds the **Tune** tab. | None |
| **Feeds inbox** | Feeds, mail, podcasts and Brief me, in the Inbox on Desk. | None |
| **Yami for your agents** | Lets coding agents notify you, ask you questions and see your projects, through a local MCP server on this PC. | None |
| **Yami Remote** | Use Yami from your phone on your home network. | None |
| **Yami Browser** | A light browser with tabs, a vault, blocking and a reader. | None |
| **Clipboard history** | Keeps recent copied text so you can find it again. | None |
| **Weather** | Today's weather, UV and air quality. | None |
| **Roaming Yami** | Yami floats around your desktop and naps when you leave her be. | None |
| **Desk widget** | A small card on the desktop with the time, weather, media and agents. | None |

## Optional downloads

Some modules use helper programs. These are never bundled with Yami. You can download them ahead of time, or Yami downloads them the first time a feature needs them.

- **File wheel** uses FFmpeg (audio and video), ImageMagick (images), 7-Zip (packing), 7-Zip extra (7z and rar), and ExifTool (metadata).
- **Offline dictation** uses the Needle engine and the Whistle speech model.

To manage them, open **Settings > Modules** and use the download's buttons:

- **Download** starts it. Progress is shown.
- **Cancel** stops a download in progress.
- **Remove** deletes the download. Your settings and files stay.
- **Try again** retries a failed download.
- **From file** installs a copy you downloaded yourself. Yami checks it against the same fixed checksum as its own download.

Downloads run one at a time. Each one is checked against a fixed checksum before it is used.

## What a module means for your PC

- A module that is off never loads, uses no timers, and opens no windows or ports.
- Modules that listen for connections, such as Yami Remote, Yami for your agents and the network shield, listen only on this PC or your home network.
- The AI workspace cannot be turned off while a meeting recording is running. Stop the recording first.
- Export and **Delete all my data** still work for a module that is off.

For how modules are built, see [how it works](how-it-works.md).
