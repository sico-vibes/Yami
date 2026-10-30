# Desk

Desk is where Yami keeps the things that happen later: reminders and routines, your inbox from the web and your mail, and your downloads.

Open Desk from the main window's dock. It has three tabs:

- **Plans**: reminders, app launches and routines.
- **Inbox**: news, posts and mail. It appears only when the **Feeds inbox** module is on.
- **Downloads**: Yami's download manager. See [downloads and the browser extension](downloads-and-browser-extension.md).

## Plans

A plan is something Yami does at a time you choose.

1. Open **Desk > Plans** and select **Add a plan**.
2. Choose what it does: a reminder, an app launch, opening a web address, a site search, or a routine.
3. Pick the time, and whether it repeats: **Once**, **Daily** or **Weekly**.
4. Select **Save plan**.

A routine runs one to ten steps in order. Each step is one of: a reminder, an app launch, a web address, a site search, a volume change, or a media control.

Plans run while Yami is running, including while it sits in the tray. If the PC was asleep or Yami was closed when a plan was due, Yami checks for missed plans when it starts again. Yami can also ask Windows to wake a sleeping PC for the next plan. Windows decides whether to do this, based on its power settings and your hardware.

Plans never change files, send mail or run commands unattended. Those actions need you to be at the PC.

## Inbox

The Inbox gathers news, posts and mail in one list, newest first. It appears when the **Feeds inbox** module is on. See [modules](../modules.md).

### Add a source

Press **Add** and type one of these:

- A subreddit, such as `r/rust`.
- Hacker News.
- A GitHub repository's releases, such as `user/repo`.
- A YouTube channel ID.
- A Bluesky profile, such as `name.bsky.social`.
- A Mastodon account, such as `@user@instance`.
- Any RSS, Atom or JSON Feed address that starts with `https://`.
- A podcast. Choose **Podcast**, type a show name, press **Search**, and then **Follow** a show.

You can add up to 50 sources. A chip for each source filters the list. Hover a chip to see its last error, or remove it. Select an item to open it in your browser.

Yami reads feeds when you open the Inbox, if they were not read in the last ten minutes, or when you press refresh. It does not check in the background.

### Mail

Mail appears at the top of the Inbox. You can add up to five accounts:

- **Gmail, Fastmail, iCloud Mail, Yahoo Mail or another IMAP server.** Use an app password from your mail provider.
- **Outlook.com.** Yami shows a short code and a link to Microsoft's sign-in page. You sign in with Microsoft, and Yami never sees your password. Outlook sign-in needs an app (client) ID that you register for free at Microsoft Entra. Paste the ID in the setting that appears.

Yami shows the unread count, the total count and the five newest senders and subjects. It only reads headers. It does not mark anything as read, move, delete or send mail, and it does not load message bodies or images.

### Brief me

Press **Brief me** to get a short bullet summary of the newest 40 headlines. Yami sends only the source names and headline titles to Gemini, and only when you press the button. It needs your Gemini key.

### Bluesky timeline

Sign in once with a Bluesky app password, not your main password. Your Following timeline then appears in the Inbox. You can read posts and open them on Bluesky. Yami cannot post, like or follow from here.

## What it needs

- The **Feeds inbox** module for the Inbox.
- An internet connection for feeds, mail, podcasts and Brief me.
- For plans that wake the PC: Windows power settings that allow wake timers.
- For Outlook.com: a free Microsoft app ID you register yourself.

## Privacy

Feed addresses and your mail account details stay on this PC. Mail passwords and tokens are encrypted with Windows. Yami contacts only the servers for the sources you add. See [providers and privacy](../providers-and-privacy.md).
