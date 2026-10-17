# Verification history

> Historical record from the previously verified Windows build. It predates the 2026-10-17 documentation, browser-preview, and replacement-wallpaper updates. It is evidence of those earlier checks, not a certification of the current release. Repeat relevant checks against the final packaged build; current procedures are in [Development and release](../development.md).

## Recorded checks

| Area | Earlier result |
| --- | --- |
| Windows app, tray, island | Electron startup, compiled C# host, tray/island behavior exercised. |
| Renderer appearance | Home, settings, loadout, and utility views captured and reviewed. Review was scoped; no pixel-perfect certification was made. |
| Dictation | A live Gemini transcription with a spoken correction was inserted into the original Windows text field. Shortcut, WebM recording, provider call, and native insertion were exercised together. |
| Clipboard, credentials, Windows reads | Native tests passed. Credential encryption was available. Clipboard test preserved and restored existing contents. |
| To-dos, memory, plans | Electron verification passed 26 checks for navigation, cancellation, shortcut capture, ability binding, target rejection, brightness support rejection, and persisted data. |
| Circle-to-ask | Native screen capture and lasso worked. Gemini text vision read a selected test image; Live voice asked about the selection and played a response. |
| Gemini tools and Tavily | A live Gemini round trip created and removed a verification to-do. Tavily quick search returned five sources; deep search returned twelve sources and recorded seven credits for that test. |
| Live voice and microphone | Gemini Live transcribed a generated test phrase and returned a spoken response. Microphone permission was checked locally without sending ambient audio. |
| Wallpaper | A previous Windows test applied a test image and restored the original wallpaper afterward. The previous bundled reference images were later replaced by the generated starter pack; run the current wallpaper check again. |
| Media, brightness, radio/Night Light, wake | Implementations were present. Hardware and Windows support vary; disruptive power and network operations were not run in those checks. |
| Power confirmation | Power actions were not executed during verification. |
| Packaged app | A previous portable build started with its native host and external assets; wallpaper application/restoration, metrics, credential encryption, and island transparency were checked. |
| Development mode | Vite/React refresh, preload, and native IPC were exercised. |

The earlier run recorded ten unit/native/provider-contract tests, a native focus/paste fixture, and 26 Electron checks. Provider contract tests used mocked responses; separate live provider calls used user-owned keys entered through Yami. No key values were included in the evidence.

## Earlier artifact identifier

The previous verified portable artifact recorded SHA-256 `BE98364E2D5B651AFB03B08AAA4CD4D0BB5BD64A9E5FBE2F77E2533019720DA8`. This digest identifies only that earlier artifact; it is not the hash for a later build.

## Reconstruction and test limits

Tests and live provider calls show that specific paths worked on the tested Windows machine. They do not prove exact Hitodama parity, universal hardware support, provider availability for every account/country, safe operation in every third-party app, or current release readiness. Never use a live user key in logs or fixture files. Never execute restart/shutdown or publish M-Lab test results just to prove the UI renders.

For current idle measurements and remaining gates, see [Performance goals](../performance.md). For features requiring dedicated Windows validation, see [Development and release](../development.md).
