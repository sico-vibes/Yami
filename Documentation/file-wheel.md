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

A plain conversion saves a new copy beside the original and shows a toast. It never overwrites the source. A name clash becomes `photo 2.png`. Compound names such as `archive.tar.gz` keep the stem `archive`. Tool copies use a suffix such as Compressed, No Metadata, Background, or Merged.

Image, audio, and video conversions build an ImageMagick or ffmpeg command and run that executable as a child process. Zip, tar, and gz are handled in Yami. Rar and 7z ask 7-Zip. PDF merge and “pages PDF” use pdf-lib inside the main process, loaded only when that job runs. The background tool draws the preview on a canvas and saves that PNG. Compress and details open a small window. Details can strip metadata with ExifTool, or with ffmpeg for audio and video.

Those engines are not shipped inside Yami. The first time a job needs one, Yami downloads it into `%LOCALAPPDATA%\Yami\engines`, checks the pinned SHA-256, and refuses to run it if the hash differs. The pins were taken on 2026-10-18 from the publisher’s checksum or from a download of that exact file. The ffmpeg URL is Gyan’s “latest release” alias, pinned to the 9.0.2 hash, so a newer upload fails closed until the pin is updated. HEIC encoding is refused. The portable ImageMagick build has no x265 encoder, and this build does not claim ffmpeg can write HEIC.

ffmpeg is asked to write `-progress pipe:1`. This build toasts when that stream prints `progress=end`. It does not turn `out_time` into a live percentage. A video target size is the exception: if `ffprobe.exe` is beside the downloaded ffmpeg, Yami reads the duration and sets a bitrate.

Zip, tar, and gz extract inside Yami. A `.7z` or `.rar` asks `7za.exe` from the 7-Zip extra package. That standalone program extracts 7z. It does not include the unRAR decoder, so a `.rar` is expected to fail with 7-Zip’s own message until a `7z.exe` build that contains unRAR is pinned. That path was not run.

Phase 2 and 3 petals are listed on the wheel. Choosing one opens a window that says the tool is not connected yet.

## Phase status

| Phase | Scope | This build |
| --- | --- | --- |
| 0 | Drag hook, wheel window, drop target, shortcut, Send to, drop shelf | Code is in the repo. The gesture rules are unit-tested. The live Windows drag is not. |
| 1 | Engines, jobs, naming, image/audio/video conversion, compress, details, background, PDF merge, archive extract | Command plans, naming, zip/tar, PDF merge, and the checksum gate are unit-tested and the PDF/zip paths were executed here. ffmpeg, ImageMagick, 7-Zip, and ExifTool were not downloaded or run. |
| 2 | Remaining image, video, audio, and PDF tools, plus QR | Not started. Those petals open a window that says they are not connected. |
| 3 | Documents, spreadsheets, subtitles, PDF to image/text, OCR, slides | Not started. Convert petals for those kinds are listed; choosing one reports that the tool is not connected. |
| 4 | HEIC encode, float shelf, remaining file actions | Not started. HEIC stays off the convert wheel. Float is listed and not connected. |

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
9. Drop a PNG on JPG. Confirm Yami downloads ImageMagick once, the checksum matches, and a new JPG appears beside the original.
10. Drop a WAV on MP3 and a short MP4 on GIF. Confirm ffmpeg downloads once and both outputs appear.
11. Open Compress, Details, and Add BG from the tools wheel. Save each and confirm the new file. Turn on “Reveal saved files” and confirm Explorer selects the result.
12. Merge two PDFs and extract a zip. Confirm the merged PDF and the extracted folder. Then drop a file on Crop or Trim and confirm the window says that tool is not connected.
