# Yami documentation

Yami is a Windows-first desktop companion. Set up voice and desktop tools, explore the application, and learn how to develop it.

Yami is both the application and the name of its cat-ghost companion. She lives in a persistent Windows island above the desktop and can roam the desktop; users can change her skin, voice, personality, and ability in the local loadout. AI inference runs through user-owned provider accounts rather than a Yami-hosted account.

![Yami desktop companion](assets/screenshots/home.png)

## Choose a guide

| If you want to… | Read… |
| --- | --- |
| Install and connect your own Gemini key | [Getting started](getting-started.md) |
| Understand voice, dictation, search, plans, utilities, or settings | [Features and settings](features-and-settings.md) |
| See which information leaves the PC and what requires confirmation | [Security and provider data flow](security-and-providers.md) |
| Follow a renderer event through Electron into Windows | [Architecture](architecture.md) |
| Run, build, package, or contribute | [Development and release](development.md) and the repository [contribution guide](../CONTRIBUTING.md) |
| Review resource targets and measurement rules | [Performance goals](performance.md) |
| Check bundled image, font, icon, and data licenses | [Asset and third-party provenance](assets-and-licenses.md) |
| Review external sources and inspiration | [Research and references](research-and-references.md) |
| See ideas that have not shipped | [Roadmap](roadmap.md) |
| Review design tokens and reconstruction constraints | [Design system](reference/design-system.md) and [product brief](reference/product-brief.md) |
| Read earlier Windows verification evidence | [Verification history](reference/verification-history.md) — historical record; check current build status in [Development and release](development.md). |

## Product boundary

Yami is a reconstruction from visual and behavioral references. The current project does not contain the original Hitodama source. Unshown screens, original prompts, earning rules, and exact effect timings are unknown; no exact compatibility claim is made. Current behavior is defined by this repository’s source code.

The app can perform local Windows actions without an AI key. Gemini enables AI conversation, dictation, vision, and tool use. Tavily is optional for web research; Wikipedia search is the no-key fallback. Provider availability and free quotas depend on the user’s account, country, model access, and provider policy. Neither provider is unlimited or guaranteed free.

Yami-authored source is MIT licensed. The repository remains private during development. The MIT license does not relicense third-party assets or dependencies; consult [asset provenance](assets-and-licenses.md).
