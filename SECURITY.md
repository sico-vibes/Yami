# Security policy

## Reporting a vulnerability

Please do not publish an exploitable security issue before a fix is available. Report it privately through GitHub: **Security › Report a vulnerability** on the repository ([new advisory](https://github.com/sico-vibes/Yami/security/advisories/new)). Include the affected version, Windows version, impact, and a minimal reproduction. Do not include API keys, private user data, or full clipboard contents. A report file from Settings › Your data › Collect logs has secrets masked, but read it before you attach it.

## Scope

Security-sensitive areas include:

- Electron renderer isolation, navigation policy, preload APIs, and IPC sender validation.
- Credential encryption, local database files, backups, exports, and data deletion.
- AI provider requests and model-issued tool calls.
- Screen, microphone, clipboard, file, terminal, window, and power actions.
- The native C# process and its line-oriented request protocol.
- Build and package scripts, dependency provenance, and release artifacts.

Yami is a local desktop application, not a security boundary between Windows users or a hardened sandbox for arbitrary commands. Terminal access is off by default and asks for confirmation when enabled. Confirmation does not make a malicious command safe. Do not enable it unless you understand the command and trust the request.

Clipboard detection is best effort. Private clipboard markers, password fields, a list of known password-manager processes, and banking-related window names are checked, but no heuristic can identify every sensitive application. Avoid copying secrets while clipboard history is enabled; pinning or exporting data changes the protection described in the data guide.

The application has no first-party telemetry or server. Provider services receive the data described in [Security and provider data flow](docs/internal/security-and-providers.md), under your own account and their current terms. Keep API keys out of issues, logs, screenshots, pull requests, and support messages.

## Supported versions

The repository currently tracks the development build. Once public releases are published, report against a supported release or the latest main-branch build and include enough version information to reproduce the issue.
