# File wheel

The file wheel opens beside the pointer while Yami is running, then converts a dropped file or starts a tool. This page records what the current build actually does. The code is on `main` (merged 2026-10-18) and is included in the local portable build. The Windows drag, hotkeys, Send to, and engine downloads have not yet been exercised on a Windows machine.

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

Those engines are not shipped inside Yami. The first time a job needs one, Yami downloads it into `%LOCALAPPDATA%\Yami\engines`, checks the pinned SHA-256, and refuses to run it if the hash differs. They can also be downloaded ahead of time, cancelled, removed or installed from a file in Settings › Modules. The pins were taken on 2026-10-18 from the publisher’s checksum or from a download of that exact file. The ffmpeg URL is Gyan’s “latest release” alias, pinned to the 9.0.2 hash, so a newer upload fails closed until the pin is updated. HEIC encoding is refused. The portable ImageMagick build has no x265 encoder, and this build does not claim ffmpeg can write HEIC.

ffmpeg is asked to write `-progress pipe:1`. This build toasts when that stream prints `progress=end`. It does not turn `out_time` into a live percentage. A video target size is the exception: if `ffprobe.exe` is beside the downloaded ffmpeg, Yami reads the duration and sets a bitrate.

Zip, tar, and gz extract inside Yami. A `.7z` or `.rar` asks `7za.exe` from the 7-Zip extra package. That standalone program extracts 7z. It does not include the unRAR decoder, so a `.rar` is expected to fail with 7-Zip’s own message until a `7z.exe` build that contains unRAR is pinned. That path was not run.

Adjust, markup, crop, redact, and collage draw in the tool window and save that picture as a new PNG. The long side is capped (1600 for adjust, 2048 for crop, 720 for the live preview) so a huge photo does not stay expanded in memory. They do not call ImageMagick. Redact is manual boxes only: face finding and text finding are not in this build, and nothing is uploaded.

Mute, trim, video crop, speed, join, snapshots, split, video redact, normalize, channels, bleep, and the waveform visualizer build ffmpeg arguments and run ffmpeg as a child process. Normalize measures loudness first and, when ffmpeg prints the measurement JSON, applies a second pass. Split copies the stream, so each cut lands on a nearby keyframe. Snapshots and split write a new folder. Speed stays between 0.5× and 2× and keeps pitch with `atempo`. These commands were checked as text. ffmpeg itself was not run.

PDF split writes one PDF per page into a new folder, up to 200 pages. Organize can reorder, rotate, duplicate, and drop pages. Both use pdf-lib and were executed here. QR reading uses jsQR in the tool window. A generated code was decoded in the unit tests. The preview picture has no code, so that window says none was found.

Subtitles convert between SRT, VTT, and plain text. Markdown conversion covers headings, paragraphs, emphasis, links, and fenced code. It is not a full Markdown parser. HTML becomes text by stripping tags. DOCX, EPUB, and XLSX are office packages written and read by Yami. CSV and TSV use the same table. A text or sheet PDF is a plain Helvetica page, not a laid-out document. PDF text uses PDF.js and was checked on a PDF this build wrote. These paths were executed in tests.

XLS and ODS are refused. The message tells you to save as XLSX or CSV. Slide files, and any conversion to PNG or JPG that is not a normal image, ask for `soffice` on the PC. Yami does not download LibreOffice. If it is missing, the job stops with that reason. That path was not run.

Copy text uses Windows' own OCR (see Copy text from an image); there is no Tesseract download.

Copy path writes the paths to the clipboard. Copy asks PowerShell to put the files on the Windows clipboard. Move asks for a folder and renames the file, copying across drives when a rename is refused. Terminal opens PowerShell in the file's folder. Those three were not run. Float opens a small always-on-top list and stays until it is closed.

HEIC is still absent from the convert wheel. The first time a convert wheel opens, if ffmpeg is already installed, Yami reads `ffmpeg -encoders` and `ffmpeg -muxers`. The HEIC petal appears only when both an HEVC encoder and an HEIC or HEIF muxer are listed. This build does not claim the pinned Gyan or ImageMagick packages can write HEIC. The probe was not run here.


## Batch rename

With two or more files selected, the tools wheel has **Rename**. It opens a tool window with a pattern such as `trip-{n}` or `{name} copy {n}` (`{n}` is a number padded to the count, `{name}` the old name), a first number, and a preview of every new name before anything changes. Extensions stay, and the order is the order you selected the files. Yami refuses names Windows cannot use, names that would clash, and anything that would overwrite a file outside the selection. Renaming goes through temporary names first, so files can swap names, and a failure puts everything back. Checked on Windows on 2026-10-28.

## Copy text from an image

For one image, the tools wheel has **Copy text**. Windows' own OCR engine (`Windows.Media.Ocr`, through `native/Ocr.ps1`) reads the text in your Windows display languages, with no download or upload, and puts it on the clipboard with a note of how many lines it copied. If Windows has no OCR language, Yami says which setting adds one. Checked on Windows on 2026-10-28 with a drawn sample image.

## Watch folders

In Settings › File wheel › **Watch folders**, choose a conversion (PDF, PNG, JPG, WebP, MP3, MP4, GIF, HTML, text or Markdown) and a folder. Each file that arrives there afterwards is converted once, beside it, using the same engines and pins as the wheel. Files already in the folder are left alone, and partial downloads (`.tmp`, `.part`, `.crdownload`) are skipped. Yami waits until a file stops changing, and never converts its own output. It listens for file-system events (`fs.watch`) instead of scanning, only while the file wheel is on and a watch is switched on, for up to ten folders. Checked on Windows on 2026-10-28 with Markdown arriving in a folder and becoming HTML.

## Folders

Folders work on the wheel too: drag one, select it in File Explorer and use the shortcut, use Send to, or drop it on the shelf. Converting and tools need files, so a selection with a folder offers the actions wheel:
- **Copy**, **Move** (across drives it copies everything first and removes the original only after the copy succeeded) and **Copy path**.
- **Terminal here**, which opens inside the folder.
- **Folder size**, which counts the files and bytes. It stops after 200,000 entries or 15 seconds and then says "at least"; links and junctions are not followed.
- **Zip**, which writes `<folder>.zip` beside it. A zip over 200 MB is refused, with a pointer to 7-Zip.
- **Find duplicates** groups identical files by size and then SHA-256, bounded like Folder size, and copies the list to the clipboard with how much space repeats. Nothing is deleted.
- **Add as project**, for one folder, adds it to the AI workspace's Projects.
- **Change icon**, for one folder, asks for an `.ico` (or an `.exe`/`.dll` icon) and writes the same `desktop.ini` Explorer's Customize tab writes: `IconResource`, hidden and system, with the folder's read-only flag so Explorer reads it. Yami marks the file as its own and never replaces a `desktop.ini` it did not write. The icon file stays where it is, so moving or deleting it brings back the usual icon. **Reset icon** removes Yami's `desktop.ini` and the flag. The desktop check sets and resets an icon on a temporary folder; how quickly Explorer repaints the icon was not measured.

- **Flatten**, for one folder, opens a small window listing every move first: each file in its subfolders moves up into the folder, a name that is already taken gets " (2)", " (3)"… so nothing is overwritten, and subfolders left empty are removed. Links and junctions are not followed, it stops at 20,000 files, and if a move fails the ones already made are put back. Checked on Windows on 2026-10-28 on a temporary folder through the tool window.

## Phase status

| Phase | Scope | This build |
| --- | --- | --- |
| 0 | Drag hook, wheel window, drop target, shortcut, Send to, drop shelf | Code is in the repo. The gesture rules are unit-tested. The live Windows drag is not. |
| 1 | Engines, jobs, naming, image/audio/video conversion, compress, details, background, PDF merge, archive extract | Command plans, naming, zip/tar, PDF merge, and the checksum gate are unit-tested and the PDF/zip paths were executed here. ffmpeg, ImageMagick, 7-Zip, and ExifTool were not downloaded or run. |
| 2 | Remaining image, video, audio, and PDF tools, plus QR | Image adjust, markup, crop, redact, and collage save a canvas PNG. PDF split and organize were executed in tests. QR reading was executed on a generated code. ffmpeg command plans for mute, trim, crop, speed, join, snapshots, split, redact, normalize, channels, bleep, and the visualizer are unit-tested and were not run. |
| 3 | Documents, spreadsheets, subtitles, PDF to image/text, OCR, slides | Subtitles, a small Markdown/HTML/text path, DOCX, EPUB, CSV/TSV/XLSX, archive repack, plain-text PDF, and PDF text extraction were executed in tests. Slides and page pictures call LibreOffice if it is already installed. That program was not run, and it is not downloaded. OCR uses Windows' own engine. XLS and ODS are refused with a message. |
| 4 | HEIC encode, float shelf, file actions | HEIC stays off the wheel until ffmpeg, already installed, reports both an HEVC encoder and an HEIC muxer. That probe was not run here. Float opens a small always-on-top list. Copy path is real. Copy, move, and the terminal are implemented for Windows and were not run. |

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

The settings screen shows the three modifiers as labelled menus (Convert, Tools and
Actions), each choosing Shift, Ctrl or Alt. Engines appear as tiles, one per helper:
FFmpeg, ImageMagick, 7-Zip, 7-Zip Extra and ExifTool. A tile shows the engine's
version (or its licence, until a version is known) and either a Ready status word or
a Get button. Get downloads and checks the engine, shows a spinning icon with
"Getting…" while it runs, and reports any failure in a note below the tiles.

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
12. Merge two PDFs and extract a zip. Confirm the merged PDF and the extracted folder.
13. Open Adjust, Markup, Crop, Redact, and Collage. Save each and confirm a new PNG. Redact should cover only the boxes you draw.
14. Open Trim, Speed, Snapshots, and Normalize on a short media file after ffmpeg has downloaded. Confirm the new copy or folder. Then try Split and confirm the clips start near the chosen times.
15. Split a three-page PDF and rotate one page in Organize.
16. Drop a photo that contains a QR code and confirm the text. A photo without a code should say none was found.
17. Convert a Markdown file to HTML, a CSV to XLSX, and an SRT to VTT. Confirm the new files beside the originals. Convert a text PDF and confirm the words survived.
18. If LibreOffice is installed, drop a PPTX on PDF. If it is not, confirm the wheel says LibreOffice is not installed and does not download it.
19. On the actions wheel, copy a path and confirm the clipboard. Move a file into another folder. Open the terminal in that folder. Pin Float and confirm the small window stays above other windows until it is closed.
20. After ffmpeg has downloaded, open the convert wheel for a photo and confirm HEIC is absent unless `ffmpeg -muxers` actually lists HEIC.
21. In Settings, open the File wheel group. Confirm each engine tile shows Ready after its download, that Get reads "Getting…" while one runs, and that a changed modifier menu moves that wheel to the new key.
