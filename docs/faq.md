# Frequently asked questions

## Is Yami free?

Yes. Yami is free and open source under the MIT License. AI features use your own accounts and keys. Google and Tavily set their own free allowances, and those can change, so check their terms.

## Do I need an account?

No account for Yami. To use AI features, you need your own Gemini API key. A Tavily key is optional. Other services, such as mail, Spotify or Bluesky, are optional and only needed if you connect them.

## Does Yami send my data anywhere?

Yami has no telemetry and no servers that collect your data. Only the features you turn on or use contact outside services, and they receive only what that feature needs. See [providers and privacy](providers-and-privacy.md) for the full list.

## Does Yami listen to me all the time?

No. The microphone is used only while you hold a voice or dictation shortcut, or while you record a meeting in the AI workspace. Yami captures part of the screen only when you draw a selection.

## Does Yami need administrator rights?

No. Most of Yami works without them. A few actions ask Windows for administrator approval, such as changing DNS settings, editing the hosts file, and some options in Tune's Administrator section. Each one shows a Windows prompt. If you decline, nothing changes.

## Which Windows versions does Yami support?

Yami is built for Windows 10 and Windows 11. It is a Windows app and does not run on macOS or Linux.

## How much memory does Yami use?

In a measured idle test of the packaged app, Yami used about 150 MB of private memory across all of its processes with its default modules. The amount depends on which modules you turn on. Turn off modules you do not use to reduce it.

## Why does Windows warn me when I start Yami?

Yami is not signed with a publisher certificate yet. Windows SmartScreen shows a warning for unsigned apps. Select **More info**, then **Run anyway**. See [troubleshooting](troubleshooting.md#windows-says-yami-is-unsafe-or-unknown).

## Does Yami work without the internet?

Yes, for many things. Windows controls, the launcher, the clipboard history, most file wheel tools, and dictation with **Whistle offline** or Windows speech all work without an internet connection. Chat, Gemini voice, web research and online feeds need the internet.

## Can Yami send emails, post messages or make purchases?

No. Yami's assistant tools cannot send email, chat messages or make purchases. Yami reads mail headers only, and it never sends mail.

## Where is my data stored?

In your Windows user account, in `%APPDATA%\Yami`. Your API keys and sign-ins are encrypted with Windows DPAPI. Helper programs for the file wheel are stored in `%LOCALAPPDATA%\Yami\engines`. See [providers and privacy](providers-and-privacy.md#where-your-data-lives).

## What happens when I close the window?

Yami keeps running in the tray, so features such as plans, the timer and the island keep working. To stop Yami completely, right-click the tray icon and choose **Quit Yami**.

## How do I remove Yami?

Yami is a portable app, so there is no installer to run. Export your data first if you want to keep it, then choose **Delete all my data** in **Settings > Your data**. Then delete the Yami file and, if you want, the `%APPDATA%\Yami` folder.

## Which AI model does Yami use?

Yami picks a model that your Gemini key can use. Setup checks the models your account can access and selects a compatible one.

## How do I report a bug?

See [Logs and reporting a bug](troubleshooting.md#logs-and-reporting-a-bug).
