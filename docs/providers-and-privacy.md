# Providers and privacy

Yami is built to keep your data on your PC. It has no account system and no servers of its own that collect your data. Yami contacts outside services only for features you turn on or use, and it contacts each one directly from your PC.

## The short version

- **Yami has no telemetry** and no hosted backend.
- **You bring your own keys.** Yami does not include a shared key for any service.
- **Every outside service is optional.** Most features work without any of them.
- **Your keys stay on your PC.** They are encrypted with Windows' own protection (DPAPI) and tied to your Windows account. They are never shown again, and they are not included in exports.
- **Free does not mean unlimited.** Free plans, quotas and country rules are set by each provider and can change.

## Outside services

| Service | Used for | What is sent | When it runs |
| --- | --- | --- | --- |
| **Google Gemini** | Chat, live voice, Gemini dictation, questions about a screen selection, Brief me, note summaries | Your messages and recent conversation, audio you speak or dictate, a selected picture, and any context you have allowed (see below) | Only when you use these features. Needs your key. |
| **Tavily** | Web search with better results and deep research | Your search query. Deep research also sends follow-up queries and up to five result links. | Only when you ask for web research. Needs your key. |
| **Wikipedia** | Basic web search when Tavily is not set up, and a short public news text for context | Search terms | Search requests. The news text loads once a day when AI context is on. |
| **Spotify** (optional) | Choosing a playback device, its volume, and play and pause | Your Spotify requests, through your own developer app | Only after you connect it. |
| **Microsoft** (Outlook.com, optional) | Reading your mail headers | Sign-in with Microsoft, then a read-only connection to your mailbox | Only when you add the account, and when the Inbox opens. |
| **Your mail provider** (optional) | Reading mail headers for Gmail, Fastmail, iCloud, Yahoo or your own IMAP server | Your app password, then a read-only connection | Only when the Inbox opens. |
| **Bluesky** (optional) | Your Following timeline | Your handle and app password, then requests for your timeline | Only after you sign in, and when the Inbox opens. |
| **Feed sources** (optional) | News, posts and podcasts in the Inbox. For example Reddit, Hacker News, GitHub releases, YouTube channels, Mastodon accounts, and any RSS feed you add. | A plain request for each feed. No account, cookie or key. | When the Inbox opens, or when you refresh. |
| **Apple iTunes Search** (optional) | Searching for podcasts | The show name you type | Only when you search for a podcast. |
| **LRCLIB** (optional) | Lyrics for the song playing | The track's artist, title and length | Only when Lyrics is on, once per track. |
| **Radio Browser** and radio stations | Finding radio stations and playing them | Your search words. Playing a station connects to that station's own server. | Only when you use Radio. |
| **Frankfurter** | Currency conversion in the launcher | The two currency codes you type (never the amount) | Only when you type a conversion. |
| **Nager.Date** (optional) | Public holidays on Today | The year and your Windows region code | Only when you turn holidays on. Cached for 30 days. |
| **Open-Meteo** and **MET Norway** (optional) | Weather, UV and air quality | Your location, rounded | Only when Weather is on. |
| **ipwho.is** (optional) | Approximate location when you have not entered a city | Your internet address, sent to find your approximate location | Only when Weather is on and no city is set. |
| **OSV.dev** (optional) | Checking a project's packages for known security issues | Package names and exact versions from the project's lock file | Only when you press **Check packages**. |
| **M-Lab** (optional) | Internet speed test | The test transfers real data, and results are published with your IP address | Only after you confirm, each time. |
| **easylist.to** (optional) | Ad and tracker filter lists for Yami Browser | Nothing about you. Yami just downloads the lists. | Only when you press **Download filter lists**, and then weekly while the browser is open. |
| **Block lists** (optional) | Blocking ads and trackers in the network shield | Nothing about you. Lists are downloaded from their public sources. | When the shield needs them, and then weekly. |
| **Quad9, Cloudflare or Google DNS** (optional) | Looking up websites for the network shield | Website names you look up, over an encrypted connection | While the shield is on. |
| **Download sites** for helper programs | Downloading the picture, audio and video helpers for the file wheel | Nothing about you. The downloaded file is checked against a fixed checksum before it runs. | Only the first time a tool needs that helper, or when you download it yourself. |
| **Hugging Face** (optional) | Downloading the Whistle offline dictation files | Nothing about you | Only when you choose Whistle offline. |
| **Subscription and service accounts** (optional, AI workspace) | Showing your subscription limits, and status for GitHub, Vercel, n8n, Notion, Cal.com, Resend and Stripe | Requests that use the sign-in your tools already have, or the token you provide | Only for services you connect. Read-only. |

Some AI workspace features use a model server or MCP server you set up yourself. Those requests go only to the address you choose.

## What Gemini receives

Gemini receives what the feature needs, and nothing more.

- **Chat:** your message, recent conversation, and the instructions that shape Yami. This includes your name, the time and time zone, and the personality you picked.
- **Context:** if **Let it see what's going on** is on, Yami sends the names of open apps (not window titles), your unfinished to-dos, and a short news text at the start of a conversation.
- **Memory:** if **Memory** is on, the facts you saved are included in the prompt.
- **Voice and dictation:** the audio you speak or dictate.
- **Screen selections:** only the picture you draw and submit. Screen capture itself happens on your PC.

Google's terms apply to what Gemini receives. Google may use data sent through its free tier to improve its products, depending on your region and Google's current terms. Read Google's terms before you connect a key.

To help keep secrets out of what you send, **Hide secrets before sending** is on by default. It replaces recognised passwords, tokens, card numbers and private keys with labelled placeholders before anything is sent. This is a safety net, not a guarantee.

## Free tiers

- **Gemini:** Google's free access depends on your account and country, and it can change. Check [Google's Gemini API documentation](https://ai.google.dev/gemini-api/docs) and [terms](https://ai.google.dev/gemini-api/terms) before you rely on it.
- **Tavily:** Tavily sets its own monthly free allowance, plans and country rules. Yami shows your usage when the account reports it. Deep research uses more credits than a quick search. Check [Tavily's plans](https://tavily.com/#pricing) and your account.
- **Spotify controls:** Spotify requires Premium for these controls.

## Where your data lives

Everything Yami saves is in your Windows user account.

| What | Where | How it is protected |
| --- | --- | --- |
| Settings, chats, plans, memories, notes and most app data | `%APPDATA%\Yami` | Stored as local files. Not encrypted. |
| API keys and sign-ins (Gemini, Tavily, Spotify, mail, Bluesky, Microsoft) | Yami's data folder | Encrypted with Windows DPAPI. Never shown again, and not exported. |
| Clipboard history | Yami's data folder | Unpinned entries are encrypted. Pinned entries are saved as plain text. |
| Bookmarks, saved logins and browsing history in Yami Browser | Yami's data folder | Encrypted with Windows DPAPI |
| Downloaded helper programs | `%LOCALAPPDATA%\Yami\engines` | Checked against a fixed checksum before they run |
| Temporary recording audio | Temporary files | Deleted when you discard, close or quit |

Exports are not encrypted by Yami. Do not use an export as a backup of your keys.

## Your controls

- **Settings > API keys:** connect, replace or remove a key. Yami does not show a saved key again.
- **Settings > Privacy:** choose what Yami may see and send. Context, Location and weather, and Lyrics are all in this section, and **Hide secrets before sending** is here too.
- **Settings > Your data:** turn clipboard history on or off, choose how long it is kept, clear history, export your data, or delete everything.

**Export my data** includes your settings, chats, plans and memories. It leaves out keys and clipboard history.

**Delete all my data** erases your local data and API keys. It cannot be undone.

## Clipboard history

Clipboard history keeps copied text for 1, 7, 14 or 30 days, up to 500 entries. Yami skips common password formats, password fields, known password-manager apps, and windows that look like banking sites. These checks are best effort. If you are not comfortable with that, turn clipboard history off.

## Limits

- Yami cannot guarantee that every secret or sensitive window is caught.
- Yami's actions run as your Windows user. A program that already runs as you can do what you can do.
- Yami does not send email, chat messages or make purchases through its assistant tools.
- Yami Remote and the Yami Browser's linked window are for trusted networks and trusted PCs. See [Yami Remote](features/remote.md) and [Yami Browser](features/yami-browser.md).

For the features behind each service, see the pages in [features](features/).
