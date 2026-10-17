# Asset and third-party provenance

Yami combines authored UI and artwork with third-party packages, icons, fonts, geographic data, and measurement workers. Each component keeps its own license. The project’s MIT license applies only to Yami-authored material.

## Visual assets

| Asset | Provenance | Redistribution status |
| --- | --- | --- |
| Spirit artwork | Authored for this project as `public/spirit.svg`. | Yami-authored; covered by the project MIT license. |
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

## Release checklist for asset changes

1. Identify the upstream or creator for every new file.
2. Verify that the license permits the intended release and redistribution.
3. Add required attribution and notices in the project and package.
4. Keep original files and license terms where the license requires them.
5. Inspect screenshots and fixtures for keys, names, and other private content.
6. Update this page and the asset manifest in the same change.
