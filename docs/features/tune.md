# Tune

Tune is Yami's Windows tune-up. It gathers settings that are normally spread across Windows, lets you change them in one place, and lets you put each one back.

Turn it on in **Settings > Modules > Windows tune-up**, or choose the Tinkerer or Everything preset. The **Tune** tab then appears in the dock of the main window.

## The golden rule: every change can be undone

Before Yami changes anything, it saves the exact earlier values. Turning a tweak off restores them. Settings that were already set before Yami touched them show **Already set** and stay locked, because there is nothing for Yami to undo.

Yami does not inject code into Windows or Explorer. Everything it changes uses settings that Windows already reads.

## Tweaks

Tweaks are switches for settings in your own account. They do not need administrator rights.

| Group | Tweaks |
| --- | --- |
| Explorer | Show file extensions, show hidden files, open File Explorer to This PC, classic right-click menu |
| Taskbar and Start | Icons on the left, End task in the taskbar menu, seconds on the clock, no web results in Start search, no suggested apps |
| Privacy | No advertising ID, no tailored experiences, no Windows tips |
| Gaming | No background game recording |
| Comfort | No Sticky Keys prompt |

Some tweaks only take effect after Explorer restarts. Yami offers **Restart Explorer** and asks first. It never restarts Explorer on its own.

### Look and feel

These settings change how Explorer and the taskbar look:

- Hide the taskbar search box or the Task View button.
- Never combine taskbar buttons.
- Compact File Explorer, show the full path in the title bar, and show selection checkboxes.
- Hide recent files on Home.
- Remove snap layouts from the maximise button.
- **Use Yami's violet as the Windows accent.** This sets Windows' accent colours to a deeper violet. Explorer picks it up after a restart.

## Startup apps

**Startup apps** lists the programs that start with Windows.

- Entries for your account can be turned off and on. Turning one off works like Task Manager does, and the program's own entry stays in place.
- Entries for all users are shown with **Needs admin**, and Yami does not change them.

## Mouse pointer

Choose a pointer scheme from the ones Windows offers, plus any you have saved, and set the pointer size from 1 to 15. **Put back** restores the earlier pointer exactly.

## Network DNS

**Network DNS** lists each connected network adapter and its DNS servers.

1. Pick a profile: Cloudflare, Cloudflare for Families, Quad9, AdGuard DNS, Google Public DNS, or **Automatic** (your router's DNS).
2. Confirm. Windows shows one administrator prompt.

**Encrypt lookups** (shown for an adapter using one of these profiles) turns on Windows 11's DNS over HTTPS for that adapter. If the encrypted resolver cannot be reached, websites stop loading, and Yami says so before you confirm.

## Administrator section

The **Administrator** section is optional. Each change asks first, then shows one Windows administrator prompt. If you decline the prompt, nothing changes.

- **Restore point.** Creates a Windows restore point named "Before changes in Yami Tune". If Windows already made one in the last day, Yami says so and keeps that one.
- **Stop two background services:** Connected User Experiences and Telemetry (DiagTrack), and Downloaded Maps Manager. Yami saves each service's start type and running state, so switching it back restores exactly what was there before.

## Network shield

The network shield is a DNS filter that runs on your PC. It blocks ads, trackers and known malicious domains in every app and browser that uses your Windows DNS.

- **How it works.** While the shield is on, Yami answers DNS on your PC. A name on a block list gets an empty answer straight away. Other lookups go to Quad9, Cloudflare or Google over DNS over HTTPS.
- **Block lists.** **StevenBlack hosts** is on by default and blocks exact names. The stricter **AdGuard DNS filter** is off by default and blocks a name and everything under it.
- **Your rules.** **Allow** or **Block** a domain and everything under it. Your rules win over the lists.
- **Page.** It shows lookups, blocked lookups and their share, the blocked count for the last 24 hours, the most blocked and most looked-up names, and the latest 15 lookups.
- **Use on <adapter>.** Points that adapter at the **Yami shield** DNS profile, with Quad9 as a second server. Quad9 is the second server, so DNS still works when Yami is not running. This needs an administrator prompt.

Names that only mean something on your own network, such as single-label names and `.local`, are never sent out.

If another program already uses port 53, the shield says so and does not start.

## Disk space

- **Show drives** lists each drive's used and free space.
- **Look inside** lists what a drive or folder holds, largest first, with size, file count and a bar for each share. Open a folder to go into it, and use the up arrow to go back. You can show any entry in File Explorer.

Disk space only reads folder sizes. It changes nothing.

## Cleanup

**Cleanup** measures, and only when you press **Measure**, these areas in your own profile:

- Temporary files that have not changed for a day.
- DirectX, NVIDIA and AMD shader caches.
- Windows error reports and crash dumps.
- Your Recycle Bin, on every drive.

Each area has its own switch. Select the areas you want, then press **Clean**. Yami asks first, skips files that are in use, and keeps each area's own folder. The Recycle Bin wording says its files cannot be restored. Cleanup needs no administrator rights.

## Installed apps

**Show apps** lists the programs that Windows Settings > Apps lists. Search by name or publisher. Each row shows the publisher, version, size and whether it is installed for you or for all users.

**Uninstall** asks first, then starts that app's own uninstaller, which shows its own windows. Yami cannot undo an uninstall.

## Hosts file

**Show entries** lists the lines of Windows' hosts file, which Windows checks before DNS.

- Each entry has a switch. Turning it off comments it out.
- **Add** writes a new line, such as `0.0.0.0 ads.example.com`.
- Each change shows one administrator prompt.
- Before its first change, Yami keeps the whole original file. **Put back** restores it exactly.

## Environment variables

**Show variables** lists your account's environment variables, the same ones Windows' **Edit environment variables for your account** changes. No administrator rights are needed.

- **Path** is shown as a list of folders, with **Add folder** and remove buttons.
- Other variables can be edited, deleted or added.
- Values with names like key, token, secret or password are hidden until you edit them.
- **Put back** restores every changed variable exactly.

Apps that are already open keep their copy of the variables. Apps you start afterwards see the change. System-wide variables are not edited.

## What it needs

- The **Windows tune-up** module.
- Administrator approval (one Windows prompt) for: DNS changes, Encrypt lookups, the Administrator section, hosts file changes, and Use on for the network shield. Everything else works without it.
- An internet connection only for the shield's block lists and its DNS lookups.

## Privacy

Tune makes no changes you have not asked for. The network shield sends lookups it does not block to the DNS provider you choose, over an encrypted connection. Block lists are downloaded from their public sources. See [providers and privacy](../providers-and-privacy.md).
