# File wheel

The file wheel opens beside the pointer while Yami is running, then converts a dropped file or starts a tool. This page records what the current build actually does. Windows drag, hotkeys, and engine downloads have not been exercised on a Windows machine in this change.

## What you can do

While a file drag is in progress, a short tap on a modifier asks Yami to open a wheel at the pointer:

| Modifier | Wheel | Default |
| --- | --- | --- |
| Shift | Convert | output formats for that kind of file |
| Ctrl | Tools | compress, details, background, and the other tools for that kind |
| Alt | Actions | copy, move, copy path, terminal, float |

The tap has to land while the left button is still down and the pointer has moved at least 12 pixels. Releasing the modifier within 350 ms counts as the tap. Holding it does not open the wheel, so Windows can still use that key for its own move, copy, or link drag. A second tap swaps the wheel in place. Escape closes it. Dropping on a petal is the trigger. The centre shows the file name and size.

The same wheel opens from three fallbacks:

- **Explorer shortcut.** Default `Ctrl+Alt+Y` reads the selected files in the foreground File Explorer window.
- **Send to.** Settings can add a “Yami file wheel” shortcut. Windows starts Yami with `--file-wheel` and the file paths.
- **Drop shelf.** The tray menu opens a small window. It is created when asked and destroyed when closed.

Plain conversions are meant to save a new file beside the original and show a short toast. Tool petals are meant to open a small window. That dispatch is not connected yet: the current build accepts the petal and reports the file names, then closes.

## Phase status

| Phase | Scope | This build |
| --- | --- | --- |
| 0 | Drag hook, wheel window, drop target, shortcut, Send to, drop shelf | Code is in the repo. The gesture rules are unit-tested. The live Windows drag is not. |
| 1 | Engines, jobs, naming, image/audio/video conversion, compress, details, background, PDF merge, archive extract | Not started. |
| 2 | Remaining image, video, audio, and PDF tools, plus QR | Not started. |
| 3 | Documents, spreadsheets, subtitles, PDF to image/text, OCR, slides | Not started. |
| 4 | HEIC encode, float shelf, remaining file actions | Not started. HEIC stays off the convert wheel until a probe says an engine can write it. |

## Windows drag, unverified

The hook lives in `native/Wheel.cs` and runs inside the existing Yami host process. It does not swallow modifier keys. Electron then creates one transparent, always-on-top wheel window for that drag and destroys it afterwards. The page is an HTML5 drop target. Paths are read in the preload with `webUtils.getPathForFile` because a `File` cannot be sent through `invoke`.

Three things are explicitly unproven:

1. A Shift, Ctrl, or Alt tap may still disturb Windows’ drag, or creating the window may cancel it. If that happens, the wheel waits briefly and then tells you to use the shortcut, Send to, or the drop shelf.
2. An elevated File Explorer will not drop into a normal Yami process.
3. Security software may flag the low-level mouse and keyboard hook. The host is unsigned.

Hook coordinates are physical pixels. Electron positions the window in device-independent pixels, converting with `screenToDipPoint` when that API exists. Multi-monitor DPI still needs a Windows check.

The Explorer shortcut uses `native/ExplorerSelection.ps1` (`Shell.Application` selected items in the foreground Explorer window). Desktop icon selection is often not that window. Use Send to or the drop shelf for icons on the desktop.

## Idle behaviour

No wheel window, shelf, or engine process exists at idle. The renderer loads the wheel scripts only for the wheel, shelf, tool, and float windows. The host hook is the same process that already handles Yami’s other global shortcuts.

## Settings

File wheel settings are stored with the rest of Yami’s settings: enable the drag gesture, pick the three modifiers, change the Explorer shortcut, reveal a finished file, play the optional tick, and install the Send to shortcut. The tick is off by default. Two wheels cannot share a modifier.

## Manual check on Windows

1. Start Yami and drag a file from File Explorer. Tap Shift, then release the file on JPG or Compress.
2. Confirm whether the original drag survives the tap. If it cancels, record that and use `Ctrl+Alt+Y` on a selected file instead.
3. Tap Ctrl and Alt while the wheel is open and confirm it swaps without moving.
4. Press Escape and confirm the window is gone.
5. Repeat from the desktop, from a second monitor, and at 150% scaling.
6. Install Send to, right-click a file, and confirm the wheel opens with that file.
7. Open the tray drop shelf, drop a file, and confirm a wheel follows.
8. Confirm Task Manager does not keep an extra Yami window after the wheel closes.
