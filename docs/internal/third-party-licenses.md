# Third-party license inventory

The current runtime npm graph has a generated [versioned inventory](assets/third-party/inventory.json) and corresponding upstream notice files in `docs/internal/assets/third-party/`. Regenerate with `npm run notices`. The build copies that folder to the packaged `resources/licenses/` directory, including Yami's MIT license and GeoNames attribution. Long upstream notices are split into consecutive parts of at most 900 lines without removing text. Electron and Chromium's runtime notices are distributed separately by Electron packaging. This inventory covers the installed runtime npm graph; it does not purport to inventory every build tool or externally hosted service.

Yami’s own source is offered under the MIT License in the repository root. That license does not cover package dependencies, upstream fonts/icons, GeoNames data, helper binaries, or photographs. Check each installed package at the exact version recorded in `package-lock.json`; include notices required for redistribution in public packages.

## Direct dependencies

This initial inventory records direct packages from the application manifest. It is a starting point, not a complete software bill of materials; transitive dependencies must be included before a release.

| Package | Use | License notice source |
| --- | --- | --- |
| `@google/genai` | Gemini SDK | Apache-2.0; [npm package](https://www.npmjs.com/package/@google/genai); Google API terms separately apply to provider use. |
| `@m-lab/ndt7` | Public internet speed-test client and workers | [GitHub project](https://github.com/m-lab/ndt7); Apache-2.0. |
| `@phosphor-icons/web` | UI icons | [GitHub project](https://github.com/phosphor-icons/web); MIT. |
| `@fontsource-variable/rubik` | Rubik font files | [Fontsource project](https://github.com/fontsource/font-files); OFL. |
| `react`, `react-dom` | Renderer UI | [React repository](https://github.com/facebook/react); MIT. |
| `motion` | UI animation | MIT; [Motion repository](https://github.com/motiondivision/motion). |
| `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-search`, `@xterm/addon-web-links` | Interactive terminal renderer, fit, scrollback search and link addons | MIT notices in the generated versioned inventory. |
| `node-pty`, `node-addon-api` | Windows PTY bridge/native addon | MIT notices, including winpty and Microsoft ConPTY; bundled binaries remain under their upstream terms. |
| `@ghostery/adblocker` 2.20.1 and its `@ghostery/*`, `@remusao/*` dependencies, `tldts-experimental` | Yami Browser's full filter lists: parses EasyList and EasyPrivacy, matches requests and returns element-hiding CSS | MPL-2.0 (the `@ghostery` and `@remusao` packages; used unmodified, source at [ghostery/adblocker](https://github.com/ghostery/adblocker)) and MIT (`tldts`). Notices in the generated versioned inventory. The filter lists themselves are downloaded by the user, not shipped. |
| `systeminformation` | Hardware and process metrics | MIT; [systeminformation repository](https://github.com/sebhildebrandt/systeminformation). |
| `pdf-lib` | PDF merge, split, organize, and image pages, run in the main process when a job needs them | MIT; [pdf-lib repository](https://github.com/Hopding/pdf-lib). |
| `jsqr` | QR reading in the file wheel's tool window, loaded only when that tool opens | Apache-2.0; [jsQR repository](https://github.com/cozmo/jsQR). |
| `pdfjs-dist` | PDF text extraction (PDF.js), loaded only for PDF text conversion | Apache-2.0; [PDF.js repository](https://github.com/mozilla/pdf.js). |
| `electron` | Desktop runtime | MIT for the project; retain runtime third-party notices for the exact release. |
| `marked` | Markdown parser used to build the docs viewer | MIT; [Marked repository](https://github.com/markedjs/marked). |
| `dompurify` | Sanitize generated documentation HTML | MPL-2.0 or Apache-2.0; [DOMPurify repository](https://github.com/cure53/DOMPurify). Choose and retain the corresponding license text for redistribution. |
| `vite`, `@vitejs/plugin-react`, `esbuild`, `electron-builder`, `@playwright/test`, TypeScript, and type packages | Build, typecheck, and verification tooling | Development-only packages may not be redistributed, but still belong in development license records. Check each installed version. |

`native/Host.cs` uses .NET Framework and Windows APIs. Its compiler/runtime dependencies are supplied by Windows. PowerShell helper scripts are project files; the NDT workers are copied from the `@m-lab/ndt7` package. Validate the output package for any additional bundled notices or binaries.

## Required release work

Before public distribution, generate the inventory from the locked production dependency graph, check direct and transitive package licenses, copy all required notice text into the release, and record exact versions. Confirm package layout to determine which development dependencies are excluded. Record licenses and origin for every bundled image and data file in [Asset and third-party provenance](assets-and-licenses.md). The old Hitodama reference wallpapers must not ship without permission.

## Asset links

- [Asset and third-party provenance](assets-and-licenses.md)
- [GeoNames terms](https://creativecommons.org/licenses/by/4.0/)
- [M-Lab ndt7 repository](https://github.com/m-lab/ndt7)
- [Phosphor web icons](https://github.com/phosphor-icons/web)
- [Fontsource Rubik files](https://github.com/fontsource/font-files)
