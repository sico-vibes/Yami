# Media and music

Yami shows what is playing on your PC and lets you control it from the island, the Controls tab, or with the keyboard. It can also show lyrics, play internet radio, and control Spotify more fully if you connect it.

## Control what is playing

The **Controls** tab and the island's now-playing card work with the app that is playing, through Windows.

- **Play and pause, previous and next.**
- **Seek:** drag the progress line.
- **Shuffle and repeat:** shown only when the app supports them. Repeat cycles through off, playlist and track.

Spotify's desktop app, browsers and most music players work this way, so you do not need a Spotify account for basic control. If an app refuses a command, Yami sends the matching media key instead.

Some apps report that they support shuffle or repeat, but do not change it. In that case Yami says so, for example "Spotify accepted the shuffle change but did not apply it", rather than showing a button that does nothing.

To open the now-playing card, hover the small pill under the island.

## App volume and output

- **App volume:** under the Controls volume slider, **App volume** lists the apps that are playing sound on your default output. Each has its own volume slider and mute button. The list is read only when you open it.
- **Play sound through:** when you have more than one output, this lets you choose the default speakers or headphones for media, games and calls.

## Lyrics

Turn on **Lyrics** in **Settings > Privacy**. The current line of a playing song then appears in the island's media card.

Yami asks LRCLIB, a free lyrics database, for the song's lyrics. It sends only the artist, title and length of the track, and it asks once per track. Answers are kept only for the current session.

## Radio

The **Radio** tab in the island drawer plays internet radio stations inside Yami.

1. Open the **Radio** tab.
2. Pick a popular station, or search by name, genre or place.
3. Press play. Radio keeps playing when you close the drawer.

Star a station to keep it, up to 50 stations. Stations are run by volunteers, so some may fail. Yami tells you when a station does not play. Windows' media keys and overlay show **Yami Radio** while it plays. Stop ends the stream.

Focus sessions can also play one of your starred stations. See [utilities](utilities.md).

## Spotify (optional)

Connecting Spotify adds what Windows cannot: choosing which device plays (your phone, a speaker or this PC), setting that device's volume, and play and pause.

You bring your own free Spotify developer app. Yami does not come with a Spotify key.

1. Create an app at the Spotify developer dashboard.
2. Add this redirect address: `http://127.0.0.1:47823/callback`.
3. Add your Spotify account under the app's user management.
4. Paste the app's Client ID into **Settings > Music**, then sign in.

Yami signs in with PKCE, so you do not need a client secret. Yami keeps the sign-in encrypted on your PC.

Spotify requires **Premium** for these controls. An app in development mode is limited to five users.

## Podcasts

Podcasts are part of the Feeds inbox. In **Desk > Inbox**, choose **Podcast**, type a show name and press **Search**. Press **Follow** to add a show. Yami reads its public feed when you open the Inbox. See [Desk](desk.md).

## What it needs

- Nothing extra for Windows media control.
- An internet connection for lyrics, radio, Spotify and podcasts.
- The **Lyrics** setting turned on for lyrics. It is off by default.
- A Spotify developer app and a Spotify Premium account for Spotify's extra controls.

## Privacy

Media control works on this PC. Lyrics requests send only the track's artist, title and length to LRCLIB. Radio stations stream from their own servers. Spotify is contacted only after you connect it. See [providers and privacy](../providers-and-privacy.md).
