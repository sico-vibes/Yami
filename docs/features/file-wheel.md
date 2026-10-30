# File wheel

The file wheel opens next to your pointer when you drag a file. From the wheel you can convert the file, run a tool on it, or act on it. The wheel also opens from File Explorer with a shortcut.

## Open the wheel

1. Start dragging a file in File Explorer.
2. While the file is still held down, tap one of the three keys below.
3. The wheel opens at the pointer. Move onto a petal and release the file to drop it.

Holding the key does not open the wheel, so Windows can still use that key for move, copy or link. Press **Esc** to close it. Tap a key again to switch to another wheel.

If the tap cancels your drag, or the wheel does not open, Yami waits briefly and then suggests one of the other ways to open the wheel below. Some security software may also block the drag gesture, so the shortcut and Send to are always there as backups.

| Key | Wheel | What it offers |
| --- | --- | --- |
| Shift | Convert | Formats for that kind of file |
| Ctrl | Tools | Compress, details, a background tool, image, audio and video tools, PDF tools and more |
| Alt | Actions | Copy, move, copy path, open a terminal here, and float a small always-on-top list |

You can change the keys in **Settings > File wheel**. Two wheels cannot use the same key.

### Other ways to open the wheel

- **Explorer shortcut.** Press **Ctrl + Alt + Y** with files selected in File Explorer.
- **Send to.** Turn on the Send to entry in **Settings > File wheel**. Then right-click a file, choose **Send to**, then **Yami file wheel**.
- **Drop shelf.** Open the Yami tray menu and drop a file onto the small shelf window.

The Explorer shortcut reads files selected in a File Explorer window. For icons on the desktop, use Send to or the drop shelf.

## Convert a file

Drop a file on a format petal. Yami saves a new copy beside the original and shows a notice. It never overwrites the original. If the name is taken, the copy becomes `photo 2.png`.

Common conversions include:

- **Documents and sheets:** Markdown, HTML, text, DOCX, CSV, TSV, XLSX and EPUB, converted inside Yami.
- **Archives:** zip, tar and gz, extracted or created inside Yami. RAR and 7z need 7-Zip.
- **Subtitles:** SRT, VTT and plain text.
- **Pictures, audio and video:** these use helper programs that Yami downloads the first time you need them. See [modules](../modules.md).
- **PDFs:** merge PDFs, split a PDF into one file per page, reorder or rotate pages, and extract text from text-based PDFs.

Slide files, and conversions to PNG or JPG from slides, need LibreOffice already installed on your PC. Yami does not download LibreOffice.

## Tools

The Ctrl wheel holds tools for a file. Each tool saves a new file.

- **Images:** adjust, markup, crop, redact (boxes you draw), collage, a background tool and metadata details.
- **Audio and video:** mute, trim, crop, change speed, join, take snapshots, split, normalise loudness, and change channels.
- **Compress** and **details** open a small window to change the settings first.
- **Copy text** reads text from an image using Windows' built-in text recognition. Nothing is uploaded.
- **Read a QR code** from a picture.

Two or more selected files also get **Rename**. Type a pattern such as `trip-{n}`, check the preview, then apply it. Nothing changes until you confirm.

## Folders

Dragging a folder offers the actions wheel:

- **Copy, move** and **copy path**.
- **Terminal here**, which opens a terminal in that folder.
- **Folder size**, which counts files and bytes.
- **Zip**, which writes a zip file beside the folder.
- **Find duplicates**, which lists identical files and the space they use. Nothing is deleted.
- **Change icon** and **Reset icon**, for a folder you choose.
- **Flatten**, which moves files from subfolders into the folder. It shows every move first.

## Watch folders

Watch folders convert new files automatically. In **Settings > File wheel**, under **Watch folders**, pick a conversion and a folder. Each new file that arrives in that folder is converted once, beside it. Partial downloads are skipped.

## Settings that affect it

- **Drag wheel:** turn the drag gesture on or off, and choose its keys.
- **Explorer shortcut:** change `Ctrl + Alt + Y`.
- **Reveal saved files:** shows the finished file in File Explorer.
- **Petal sound:** a short tick when the highlighted petal changes. Off by default.
- **Engines:** download, cancel, remove or install a helper from a file you downloaded yourself.

## What it needs

- The **File wheel** module turned on.
- Helper programs for pictures, audio and video. They download once, on first use, from their publishers and are checked against a fixed checksum before they run. You can also download them ahead of time in **Settings > Modules**.
- An internet connection for those first downloads only.
- Nothing needs administrator rights.

## Privacy

Files are processed on your PC. The only network use is downloading the helper programs, and no file is sent anywhere.

## Limits

- HEIC images are not offered as a conversion.
- Some tools depend on the helper programs above. If a conversion fails, Yami shows the reason.
