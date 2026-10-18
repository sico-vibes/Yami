# Research and references

## Utility, launcher, and customization references (2026-10-18)

The [feature recommendations note](research/feature-recommendations-2026-10-18.md) records these sources, checked on 2026-10-18:

- [Hitodama](https://hitodama.in/) — the inspiration; a paid Windows voice assistant. Its public page lists no skin packs, utilities suite, or cursor control.
- [omacale](https://github.com/AyushKr2003/omacale) — a GPL-3.0 Caelestia-style shell for Omarchy. Idea source only.
- [omarchy-dynamic-island](https://github.com/Arjun010011/omarchy-dynamic-island) — an MIT Dynamic Island for Omarchy. Its plugin catalogue page at [plugins.omarchy.org](https://plugins.omarchy.org/plugin.html?id=omarchy-dynamic-island) reported "Plugin not found" on the same date.
- [Raycast](https://www.raycast.com/raycast-vs-alfred) — launcher reference. Plan and pricing descriptions conflicted across [Toolradar](https://toolradar.com/tools/raycast/reviews), [The Sweet Setup](https://thesweetsetup.com/?p=162473), and [Asian Efficiency](https://www.asianefficiency.com/productivity/raycast-mac-productivity-hub/); check the official page before relying on any of them.
- [CursorFX on WinCustomize](https://www.wincustomize.com/article/308547) — a commercial Windows cursor customizer; reference for the cursor manager idea.
- [omarchy-waybar-config](https://github.com/gupta-akshay/omarchy-waybar-config) — an example of the Omarchy theme community.
- [PowerToys](https://github.com/microsoft/PowerToys) — MIT; a reference for keep-awake, window zones, colour picking, and text extraction. Its features were recalled from public descriptions and need a check against the current project.

These are ideas, not dependencies. Yami copies no code, artwork, or wording from them.

## Desk shell, dock, widget, and folder references (2026-10-18)

The [feature recommendations note](research/feature-recommendations-2026-10-18.md) sections 2 and 4 record these sources, checked on 2026-10-18:

- [end4-pC](https://github.com/pctrade/end4-pC) — a personal fork of illogical-impulse with a bar, a launcher, widgets, and presets. The [GitHub API](https://api.github.com/repos/pctrade/end4-pC) reports GPL-3.0.
- [illogical-impulse (dots-hyprland)](https://github.com/end-4/dots-hyprland) — the upstream Hyprland shell, with an overview, sidebars, AI, and translation. GPL-3.0.
- [Flairy: Custom Folder Icons](https://apps.apple.com/us/app/flairy-custom-folder-icons/id6785116899?mt=12) — a free Mac app for folder icons. Its features were read from the App Store listing.
- [SHAppBarMessage](https://learn.microsoft.com/en-us/windows/desktop/api/Shellapi/nf-shellapi-shappbarmessage) and [Shell messages](https://learn.microsoft.com/en-gb/windows/win32/shell/messages) — app bar reservation of a screen edge.
- [GHacks on third-party widgets](https://www.ghacks.net/?p=181162) and [BetaNews on third-party widgets](https://betanews.com/2022/10/06/windows-11-build-25217-third-party-widgets/) — preview-era coverage of the Windows Widgets board. Check Microsoft Learn for current requirements.
- [Windows Mode on Rainmeter skins](https://www.windowsmode.com/?p=45807) — skins and their scripting.
- [Customizing Icons (MSDN archive)](https://msdn2.microsoft.com/en-us/library/bb776856(v=vs.85)) and [WinHelpOnline on folder icons](https://www.winhelponline.com/blog/shell-folders-are-displayed-with-the-standard-folder-icon-in-windows/) — the folder icon mechanism.
- [Omarchy Dynamic Island](https://github.com/Arjun010011/omarchy-dynamic-island) — MIT; a Linux island with an activity model.
- [Filee](https://github.com/KnifeLemon/Filee) — an MIT file converter for Windows, macOS, and Linux with route chaining, batch, watch folders, and a checksum-verified engine script. Its engine script is at [fetch-engines.ps1](https://raw.githubusercontent.com/KnifeLemon/Filee/main/build/fetch-engines.ps1). Format counts and speed are unverified.

These are ideas and platform references. Yami copies no code, artwork, or wording from them.

Research links used to inform this documentation and its comparison notes. External pages can change after the date checked; links point to upstream projects and providers rather than copied snapshots.

## Documentation structure

The [Paperclip Quickstart Path](https://docs.paperclip.ing/guides/getting-started/five-minute-path/) informed the choice to put a short, ordered getting-started route before deeper reference guides. Paperclip is unrelated to Yami; no Paperclip code, product claims, or dependencies are included.

## Provider documentation

- [Google Gen AI JavaScript SDK](https://googleapis.github.io/js-genai/) — SDK behavior and method references.
- [Google Gemini API documentation](https://ai.google.dev/gemini-api/docs) — Gemini Developer API account, model, and request documentation.
- [Google Gemini API terms](https://ai.google.dev/gemini-api/terms) — current service terms.
- [Tavily API reference](https://docs.tavily.com/documentation/api-reference/introduction) — request formats and endpoint behavior.
- [Tavily pricing](https://tavily.com/#pricing) — current plan and credit details. Check the signed-in account because plan details can change.
- [MET Norway Locationforecast API](https://api.met.no/weatherapi/locationforecast/2.0/documentation) — weather endpoint and use policy.
- [ipwho.is](https://ipwho.is/) — optional approximate IP-location service.
- [M-Lab ndt7](https://github.com/m-lab/ndt7) — speed-test client and disclosure context.
- [GeoNames](https://www.geonames.org/) — city dataset source; licensing details are in [asset provenance](assets-and-licenses.md).

## Open-source product comparisons

The [2026-10-17 desktop adaptation review](research/adaptation-review.md) examines pinned Coucou, Terax AI and CodeNotch source revisions for terminal, agent activity, service/model-server connections and subscription usage. It records source/module links, license boundaries, Yami placements and unresolved verification. The corresponding [adaptation policy](adaptation.md) is an engineering rule; the reviewed feature additions remain proposals.

For the 2026-10-17 check, GitHub repository metadata reported MIT for [Flow Launcher](https://api.github.com/repos/Flow-Launcher/Flow.Launcher), MIT for [Handy](https://api.github.com/repos/cjpais/Handy), GPL-3.0 for [Nectar](https://api.github.com/repos/kua8/Nectar), and MIT for [PowerToys](https://api.github.com/repos/microsoft/PowerToys). These projects inform ideas about keyboard-first launch, speech capture, island/dock UI, and utility grouping. They do not establish Yami’s memory use, performance, support, or safety. Recheck upstream license files before borrowing code or assets.

Community sources are context, not controlled measurements or official product records:

- [Reddit discussion: lightweight Windows utilities](https://www.reddit.com/r/windows/comments/6uwixq/what_are_your_top_lightweight/)
- [Reddit discussion: open-source Windows apps](https://www.reddit.com/r/windows/comments/wlc4ov/open_source_windows_apps_you_might_not_have_heard/)
- [Hacker News discussion: Windows native app development](https://news.ycombinator.com/item?id=47475938)

No RAM numbers from these threads are treated as evidence. Yami’s own resource budgets require the repeatable process-tree method documented in [Performance goals](performance.md).

## File wheel technique

The Windows drag wheel was informed by public projects: [Hyoi](https://github.com/hibara/Hyoi) (MIT), [Holdem](https://github.com/iamzubin/holdem) (MIT), [Wedge](https://github.com/Regncreative/Wedge) (MIT), [Kando](https://github.com/kando-menu/kando), and Explorer integration ideas from [PowerToys](https://github.com/microsoft/PowerToys). Yami does not copy their code, artwork, or interface. The wheel’s appearance comes from Yami’s own dark glass, Rubik type, and accent colours. A separate Mac utility was used only as a behaviour reference for “drag, tap a modifier, drop on a petal”; its layout, wording, and branding are not used.
