# Contributing

Thanks for helping improve Yami. Keep changes focused, preserve existing user data and API connections, and document what the app actually does. Yami is Windows-first and its native actions must be reviewed as carefully as its UI.

## Before opening a change

1. Read the [architecture](docs/internal/architecture.md), [security and provider flow](docs/internal/security-and-providers.md), and [performance goals](docs/internal/performance.md) when your work touches those areas.
2. Open an issue or describe the problem and intended behavior in your pull request. For a larger change, include the UX, Windows support, privacy, accessibility, and performance consequences.
3. Check asset and dependency provenance before adding files. New artwork needs source, creator, license, and redistribution terms recorded in [the provenance guide](docs/internal/assets-and-licenses.md).
4. Keep docs aligned with the implementation. Mark future capabilities **Planned** instead of describing them as available.

## Development setup

Use Windows for native integrations and packaged-app validation. With Node.js/npm installed:

```powershell
npm install
npm run dev
```

The native host is built with the Windows .NET Framework C# compiler through `npm run build:native`; a separate .NET SDK is not required. See [Development, build, and release](docs/internal/development.md) for scripts and packaging details.

Never commit provider keys, user conversations, clipboard contents, screenshots containing private information, or local `.artifacts` evidence. Use synthetic fixtures for tests. Keep fixture responses clearly separate from live Windows or provider behavior.

## Code standards and checks

`npm install` turns on a git pre-push hook (`.githooks/pre-push`) that runs `npm run verify`. The same checks run in CI on every push and pull request:

| Check | Command | What it enforces |
| --- | --- | --- |
| File size | `npm run check:lines` | Every authored text file stays at or below 1,000 lines; split by responsibility first. |
| UI rules | `npm run check:ui` | No raw colours outside the design tokens, no native `<select>`, no `title=` tooltips. |
| Lint and format | `npm run check:biome` | [Biome](https://biomejs.dev) with the recommended rules (`biome.json`); `npm run format` and `npm run lint` fix and list. Rules that are warnings are known debt to pay down, not new patterns to copy. |
| Secrets | `npm run check:secrets` | No credentials, profiles, recordings, executables or build output in tracked files. |
| Types | `npm run typecheck` | TypeScript in strict mode. |
| Native build | `npm run build:native` | The C# Windows helper compiles. |
| Tests | `npm test` | Unit tests in `tests/`. |

Code style is what Biome formats: two spaces, double quotes, semicolons, trailing commas, 80 columns. Name things for what they do, keep comments for the why, and match the surrounding code. After an npm install or update, run `npm run lock:compact`. New dependency versions must be at least two weeks old, and must not be paid.

## Review expectations

- Preserve the user’s local conversations, settings, clipboard data, and provider keys across upgrades. Add a documented migration only when the data shape genuinely requires it.
- Keep renderer access behind the typed/narrow preload API. Do not enable renderer Node.js integration or expose arbitrary IPC.
- Validate provider tool arguments in the main process. Keep confirmation on destructive or sensitive actions and keep unattended schedules restricted to the explicit allowlist.
- Treat screen text, web pages, files, model output, and tool responses as untrusted input.
- Do not claim parity with undocumented Hitodama behavior.
- For low-level feature changes, add meaningful tests where a regression could affect user data, authorization, or Windows actions. Do not add tests that duplicate a trivial implementation detail.
- Run only the checks relevant to your change, and report what ran and what could not be tested. Provider contract fixtures do not count as live provider validation.

## Pull requests

Include the user-visible change, why it is needed, relevant privacy or platform effects, validation performed, and any limitations. Add screenshots only when the UI changes, and verify that they contain no API keys or personal data. Keep each authored documentation file at or below 1,000 lines.

## License and conduct

Yami-authored source is offered under the MIT License. Third-party code and assets remain under their own licenses. Be respectful and constructive in issues and reviews; do not post secrets or personal data.
