# Research and references

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

For the 2026-10-17 check, GitHub repository metadata reported MIT for [Flow Launcher](https://api.github.com/repos/Flow-Launcher/Flow.Launcher), MIT for [Handy](https://api.github.com/repos/cjpais/Handy), GPL-3.0 for [Nectar](https://api.github.com/repos/kua8/Nectar), and MIT for [PowerToys](https://api.github.com/repos/microsoft/PowerToys). These projects inform ideas about keyboard-first launch, speech capture, island/dock UI, and utility grouping. They do not establish Yami’s memory use, performance, support, or safety. Recheck upstream license files before borrowing code or assets.

Community sources are context, not controlled measurements or official product records:

- [Reddit discussion: lightweight Windows utilities](https://www.reddit.com/r/windows/comments/6uwixq/what_are_your_top_lightweight/)
- [Reddit discussion: open-source Windows apps](https://www.reddit.com/r/windows/comments/wlc4ov/open_source_windows_apps_you_might_not_have_heard/)
- [Hacker News discussion: Windows native app development](https://news.ycombinator.com/item?id=47475938)

No RAM numbers from these threads are treated as evidence. Yami’s own resource budgets require the repeatable process-tree method documented in [Performance goals](performance.md).
