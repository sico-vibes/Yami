# Asset and third-party provenance

## Adaptation research

The [Coucou, Terax and CodeNotch review](research/adaptation-review.md) imports no upstream runtime code, dependencies or assets. Research checkouts/downloads remain under ignored local artifact directories. Coucou's MIT code license is separate from its reserved branding/character/media license; Terax's root is Apache-2.0 with additional terminal-component provenance; CodeNotch's root and Windows code are MIT with separate third-party asset notices. Recheck the exact reused files and required attribution before implementing any proposed adaptation. Yami keeps its own character, artwork, copy, sounds and design language under the [adaptation rules](adaptation.md).

Yami combines authored UI and artwork with third-party packages, icons, fonts, geographic data, and measurement workers. Each component keeps its own license. The project’s MIT license applies only to Yami-authored material.

## Visual assets

| Asset | Provenance | Redistribution status |
| --- | --- | --- |
| Cat-spirit artwork | Authored for this project in `src/yami/` (exported with `scripts/export-spirit.mjs`) as `public/spirit.svg`, `public/yami-icon.png` and `public/yami.ico`. Its look was guided by user-supplied reference images; no image data from those references is included. | Yami-authored; covered by the project MIT license. |
| Ten-image starter wallpaper pack | Original environmental illustrations generated for Yami. The files are `starter-01.jpg` through `starter-10.jpg`, 1920×1280 JPEG. Scene titles and generation provenance are in [`public/wallpapers/pack.json`](../public/wallpapers/pack.json). | The manifest states the pack was generated for Yami and included with the project’s MIT distribution to the extent copyright applies; no third-party artwork, characters, logos, or reference images were used. |
| Earlier development wallpapers `wallpaper0.jpg` through `wallpaper4.jpg` | Downloaded from `https://hitodama.in/images/wallpapers/wallpaper0.jpg` through `wallpaper4.jpg` for personal reference recreation. | No redistribution or relicensing claim is made. These files have been removed from the current bundled starter pack. Startup filters matching legacy wallpaper paths from the active library; local source images are not deleted. |
| Application icon | Built from project artwork with `scripts/create-icon.mjs` and `scripts/icon-app.cjs`; output files are `public/yami-icon.png` and `public/yami.ico`. | Yami-authored unless a later asset note says otherwise. |
| Screenshots in the README | Captured from this Yami build at `Documentation/assets/screenshots/`. | Project screenshots; inspect and remove any accidental personal information before sharing. |

When introducing or updating an asset, record its filename, creator or source, license, attribution requirement, and redistribution status. Do not infer rights from a publicly accessible URL. Generated artwork should have a clear prompt/date or generation record and confirmation that it was made for Yami. The wallpaper pack manifest includes its prompt template and scene descriptions.

## Data assets

`public/cities.json` is derived from the GeoNames `cities15000.zip` dataset under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). GeoNames attribution is required. The bundled data is used only for city lookup when the user enters a location.

## Third-party runtime components

The lockfile records exact package versions. Top-level runtime dependencies include React and React DOM, Electron, `@google/genai`, `systeminformation`, `@m-lab/ndt7`, Phosphor web icons, Rubik via Fontsource, and Motion. Each transitive dependency may have separate terms. Check the package’s `LICENSE` file and the lockfile version before modifying or redistributing a dependency. Keep the license text and notices required by dependencies in the packaged distribution.

| Component | Role | License/provenance to retain |
| --- | --- | --- |
| `@google/genai` | Gemini Developer API SDK. | Google package’s published license and usage terms; Google API terms separately apply to provider use. |
| `@m-lab/ndt7` | Internet speed test client. | Apache License 2.0. The two ndt7 worker files are copied from the installed package. |
| `@phosphor-icons/web` | Interface icon font. | MIT; check upstream package notices for bundled font asset details. |
| `@fontsource-variable/rubik` | Rubik font assets. | SIL Open Font License (OFL). |
| React, React DOM, Motion, `systeminformation` | UI, animation, hardware metrics. | Retain each package’s license notice; do not assume one blanket license for all dependencies. |
| Electron, Vite, esbuild, electron-builder, Playwright | Desktop runtime and build/test tooling. | Retain package notices required for redistributed runtime components; development-only tools are not necessarily shipped. |

This table is a navigation aid, not a complete generated software bill of materials. Before a public release, produce a versioned dependency-license inventory from the exact install/lockfile, include required notice texts in the package, and review native/helper binaries as well as npm packages. Check that replacement wallpapers and every other non-code asset are represented in the asset manifest. Do not label the old Hitodama wallpapers as MIT or Yami-owned.

## File wheel engines

These programs are not bundled in the Yami package. A job downloads one into `%LOCALAPPDATA%\Yami\engines` and runs it as a separate process. The pinned checksums and the date they were checked are in `electron/wheel/engine-catalog.ts`.

| Engine | Role | License | How it was pinned |
| --- | --- | --- | --- |
| FFmpeg 9.0.2 essentials, Gyan build | Audio and video conversion, compress, media metadata removal | GPL-3.0-only. Acceptable here because Yami is private and the binary is not linked. | SHA-256 from `ffmpeg-release-essentials.zip.sha256` on gyan.dev, 2026-10-18. |
| ImageMagick 7.1.2-34 portable Q16-HDRI | Raster conversion and image compress | [ImageMagick License](https://imagemagick.org/script/license.php) | SHA-256 published on the GitHub release, 2026-10-18. HEIC encoding is not available in this build. |
| 7-Zip 26.04 `7zr.exe` and `7z2604-extra.7z` | Extract 7z and rar. Zip, tar, and gz are implemented in Yami. | GNU LGPL. The RAR decoder adds the unRAR restriction. | SHA-256 computed from the files downloaded from 7-zip.org on 2026-10-18. |
| ExifTool 13.59 Windows x64 | Read and strip image metadata | GPL-1.0-or-later OR Artistic-1.0-Perl. The zip also contains Strawberry Perl notices. | SHA-256 from `exiftool.org/checksums-13.59.txt`, matched against the SourceForge download on 2026-10-18. |
| Needle engine (`needle.exe`, Windows x86-64) from Cactus-Compute/needle3 at commit `d6c7d6a` | Runs Whistle for offline dictation | Apache-2.0 | Hugging Face LFS SHA-256, matched against a download on 2026-10-28. Owned by the Offline dictation module, not the file wheel. |
| Mailpit 1.31.5 (`mailpit-windows-amd64.zip`) from axllent/mailpit | Local mail catcher in Dev › Projects | MIT | GitHub release asset digest, matched by Yami's downloader on 2026-10-28. Owned by the AI workspace module; downloaded on request, never bundled. |
| Whistle speech model (`whistle.cact`, 16.9 MB) from Cactus-Compute/whistle at commit `7411186` | Offline speech-to-text | Apache-2.0 | Hugging Face LFS SHA-256, matched against a download on 2026-10-28. |
| pdf-lib | Merge, split, and organize PDFs, and build a PDF from PNG or JPEG pages | MIT. It runs inside the Electron main process and is imported only for that job. | npm lockfile. |
| jsQR | Read a QR code from an image in the tool window | Apache-2.0. Loaded only when that tool opens. | npm lockfile. |
| PDF.js (`pdfjs-dist`) | Read text from a PDF | Apache-2.0. Loaded only when a PDF is converted to text, Markdown, or EPUB. The package stays outside the main bundle so its font files can be read from disk. | npm lockfile. |

No code, artwork, or wording was copied from the Mac utility used as a behaviour reference, or from Hyoi, Holdem, Wedge, Kando, or PowerToys.

## Release checklist for asset changes

The terminal adds `@xterm/xterm` 6.0.0, `@xterm/addon-fit` 0.11.0, `node-pty`
1.1.0 and `node-addon-api` 7.1.1 (MIT; retain bundled Windows binary notices).
Exact notices are collected in `assets/third-party/` and packaged licenses.
Backgrounds reuse Yami starter images or a user-picked image. No upstream artwork,
Mochi branding or downloaded reference assets are shipped. New workspace/terminal
screenshots use synthetic browser fixtures without credentials or real shell data.
See the [pinned source review](research/adaptation-review.md) for upstream licenses.

1. Identify the upstream or creator for every new file.
2. Verify that the license permits the intended release and redistribution.
3. Add required attribution and notices in the project and package.
4. Keep original files and license terms where the license requires them.
5. Inspect screenshots and fixtures for keys, names, and other private content.
6. Update this page and the asset manifest in the same change.
