# Yami Remote

Yami Remote lets you use Yami from your phone, when the phone is on the same home network as your PC. You can approve coding agents, control music, and send text to your PC's clipboard. You can also view your PC's screen and control it, if you turn those on.

Yami Remote does not connect through the internet. To reach your PC from away from home, use your own VPN, such as Tailscale.

## Pair your phone

1. Turn on **Yami Remote** in **Settings > Modules**.
2. Open **Settings > Phone**. A pairing code appears.
3. Scan the code with your phone's camera. The Yami page opens in your phone's browser.

Windows may ask once whether to let Yami through the firewall on private networks. Allow it only on networks you trust.

To remove all paired phones, press **New pairing code** in **Settings > Phone**.

## What your phone can do

Each ability has its own switch in **Settings > Phone**.

| Ability | Default | What it does |
| --- | --- | --- |
| Approve agents | On | Shows coding agents' permission requests with **Deny** and **Allow once**. |
| Control music | On | Back, play or pause, and next for what is playing on the PC. |
| Send to the clipboard | Off | Puts text you send on the PC's clipboard, up to 10,000 characters. |
| View the screen | Off | Shows a picture of your PC's main screen, while the phone's Screen section is open. |
| Control the PC | Off | Taps, right-clicks, scrolls and types on the PC. Needs **View the screen** as well. |

When viewing starts again after a minute, Yami shows a notice on the PC. Yami does not capture the screen when nothing is viewing it.

Control the PC cannot control windows that run as administrator. It types text and presses only a short list of keys: Enter, Backspace, Tab, Esc, Space and the arrow keys.

## Settings that affect it

- **Yami Remote** module (Settings > Modules).
- The ability switches and **New pairing code** (Settings > Phone).

## What it needs

- The **Yami Remote** module.
- A phone on the same network as your PC, with a camera for pairing.
- Windows firewall permission for private networks, once.

## Privacy

Yami Remote sends traffic only on your home network. The phone page is plain HTTP, so use it only on networks you trust. The pairing token is stored encrypted on your PC. Screen pictures go only to the phone that asked for them, and only while it is viewing. See [providers and privacy](../providers-and-privacy.md).
