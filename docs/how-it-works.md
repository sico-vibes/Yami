# How it works

This page is a short tour of Yami's design, for people who are curious about how it is built. You do not need it to use Yami.

## The three parts

Yami is made of three parts that talk to each other.

1. **The island and the windows.** The visible parts are built with React and TypeScript, the same way many modern desktop apps are. Each window runs in a sandbox. It cannot reach Windows, your files or your keys directly.
2. **The main process.** Built on Electron, this is the part that runs Yami. It owns your settings and data, makes every request to an outside service, and decides which actions are allowed. Actions you approve, such as closing a window, always go through this part.
3. **A small Windows helper.** A C# program that Yami starts in the background. It uses Windows' own interfaces for things like global shortcuts, window control, audio, brightness and the clipboard. Yami talks to it by sending short messages back and forth.

The windows never talk to Windows or to outside services directly. Everything passes through the main process, which keeps the rules in one place.

## Everything is optional

Each feature is a module. A module that is off never loads: it starts no timers, no helper programs and no network listeners. Modules load on demand, the first time you open their page or use their feature. For example, the AI workspace stays asleep until you open its tab, start an agent, or use its shortcut.

Helper programs for the file wheel, and the Whistle speech model, download only when you use the feature that needs them. Each download is checked against a fixed checksum before Yami runs it.

## Your data stays local

- Settings, chats, plans, notes and other app data are saved as local files in your Windows user account.
- Keys and sign-ins are encrypted with Windows DPAPI, so only your Windows account can read them.
- Yami has no servers of its own that collect your data.

## Outside services

Yami calls outside services directly from the main process, using the keys you provide. The renderer never sees your keys. Each service is listed in [providers and privacy](providers-and-privacy.md).

## Idle behaviour

Yami tries to stay quiet when you are not using it. A few features check for work on a short interval while Yami runs, such as plans, and the clipboard when clipboard history is on. Most other features read their state only when you open them. Yami can ask Windows to wake a sleeping PC for the next plan, and Windows decides whether it does.

## For developers

If you want to build Yami from source, read [CONTRIBUTING.md](../CONTRIBUTING.md). It covers how to set up the project, run it, and send a change.
