# Voice and dictation

Yami can listen to you and answer out loud, type what you say into any text box, and show what it hears as a caption while you speak.

## Talk to Yami

1. Hold **Win + Alt**.
2. Speak.
3. Let go. Yami answers.

Yami streams your voice to Gemini while you hold the key, and it does not send anything while idle. You can also type in the **Home** chat. Yami can use the same tools for voice and text.

While you talk, a caption pill at the bottom of the screen shows the keys you are holding, what Yami heard (`You`), and then its reply (`Yami`). The caption closes a few seconds after the conversation ends.

You can also use **Circle to ask** (below) and attach a file or text to a chat message with the attach button on Home.

## Dictate text

Dictation types into the text box that had focus when you started.

1. Click into a text box, in any app.
2. Hold **Ctrl + Win** and speak.
3. Let go. The text appears in that box.

Yami uses the box you started in, even if focus moves while you speak. Password fields are never typed into.

### Choose a dictation engine

Open the **AI** tab in the main window, choose **Dictation**, and pick an engine:

| Engine | What it does | Internet |
| --- | --- | --- |
| Gemini (default) | Sends your recording to Gemini, which transcribes it and fixes spoken corrections. | Yes |
| Windows speech | Uses a speech recognizer you have installed in Windows. | No |
| Whistle offline | Runs the Whistle model on your PC's processor. Works in English, German, French, Spanish, Italian, Dutch and Polish. | No |

Choosing **Whistle offline** turns on the **Offline dictation** module and downloads about 18.5 MB of files once. After that, dictation does not use the internet.

### Your words and snippets

- **Dictionary rules** replace a word or phrase with what you want. For example, you can teach Yami to write a name correctly.
- **Snippets** turn a short spoken phrase into a longer piece of text.
- **Clean-up** can polish dictated text for apps you choose. It is off by default, and only apps you pick send text to Gemini for this.

## Captions

Captions appear at the bottom of the screen while you talk or dictate. With Whistle offline, the caption updates as you speak.

## Circle to ask

1. Hold **Ctrl + Shift**.
2. Draw a loop around anything on screen.
3. Let go to finish the selection. Press **Esc** to cancel.

With a Gemini key connected, the selected picture goes to Gemini with your voice question. Without a key, the picture stays on your PC.

## Accent characters

Accent characters let you type letters such as é or ñ without special keys.

1. Turn on **Accent characters** in **Settings > Shortcuts**.
2. Hold a letter for about 0.3 seconds, then press **Space**.
3. A strip at the top of the screen shows the accented forms. Press **Space** or the right arrow to move along, or the left arrow to move back.
4. Release the letter to type your choice. Press **Esc** to cancel.

Typing quickly does not trigger this. It covers the letters A, C, D, E, G, I, L, N, O, R, S, T, U, Y and Z.

## Settings that affect it

- **Settings > Shortcuts.** Change the voice, dictation and circle shortcuts, or turn them off.
- **Settings > System > Microphone.** Choose the microphone, or leave it on the Windows default.
- **Settings > Behavior > Noise suppression.** Asks the microphone pipeline to reduce background noise.
- **Circle to ask** sends a picture only after you draw a selection and submit it. Yami never sends a picture on its own.

## What it needs

- A microphone, and permission for desktop apps to use it in Windows.
- An internet connection for Gemini voice and Gemini dictation. Windows speech and Whistle offline work without one, but Windows speech needs a recognizer installed.
- A Gemini key for voice, chat and Gemini dictation.

## Privacy

Gemini receives the audio you send for voice and Gemini dictation, plus any screen selection you submit. Windows speech and Whistle offline do not send audio anywhere. Dictated text is also saved in your chat history on this PC. See [providers and privacy](../providers-and-privacy.md).
