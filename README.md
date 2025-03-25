# Otto AI

<img src="image.png" width="200" />

Otto was my monkey plush, now is my personal AI assistant.

## Development

You have to satisfy some dependencies that can be installed via a script based on your platform.

- `./deps/macos/install.sh` if you run on macOS
- `./deps/pi/install.sh` if you run on a Raspberry Pi

Then:

```sh
cp .env.example .env
pnpm install
pnpm run start:dev
```

If you're going to work on the client:

```sh
cd src-client
pnpm run start:dev
```

### I/O Drivers

I/O drivers are the the way the AI handles inputs and output.

Every I/O driver must expose these methods:

- `start` - To start receiving inputs
- `output` - To process output

You can configure the I/O driver you want to spawn on your server via config,
using the `ioDrivers` keyword.

```json
{
  "ioDrivers": ["telegram", "messenger"]
}
```

You can temporary use a driver without altering your configuration by setting an environment var:

```
export OTTO_IO_DRIVERS="telegram,test"
```

I/O drivers available at the moment:

- **Voice**: handle input using microphone and speech recognizer and output using a TTS via a speaker
- **Telegram**: handle I/O for a Telegram bot
- **Web**: handle I/O via Rest API

#### IO.Voice

This is the main I/O driver.

It uses your microphone to register your voice;
once it detects an hot word (example: _Hey BOT_),
it sends the stream through an online speech recognizer and return the speeech.

When you finish to talk, it sends the recognized speech over AI that could return
a output speech; it is sent over an online TTS to get an audio file that is played over the speaker.

#### IO.Telegram

It listens via webhook (or via polling) the chat events of your Telegram bot,
send the text over AI that return an output.

The output is used to respond to the user request via Telegram.

#### IO.Web

It provides a REST API interface to interact with the bot.

## I/O Accessories

I/O Accessories are similar to drivers, but don't handle input and output direclty.
They can be attached to I/O driver to perform additional things.

You can temporary use a accessory without altering your configuration by setting an environment var:

```sh
export OTTO_IO_ACCESSORIES=telegram,test
```

## REST API

### `/api/input`

Provide an input to the API and post the output in the io_channel specified.

Parameters:

- `io_channel`: IO Channel ID
- `person`: Person ID
- `params`:
  - `text|command`: Input text or command
  - `role?`: "developer", "user" or "assistant"
  - `context?`: object with context
  - `bag?`: metadata

```sh
IO_CHANNEL_ID="" 
PERSON_ID="" 
TEXT="$1"
curl https://otto.kopiro.me/api/input \
-X POST \
-H "Content-Type: application/json" \
-d "{\"io_channel\":\"$IO_CHANNEL_ID\",\"person\":\"$PERSON_ID\",\"params\":{\"text\":\"$TEXT\"}}"
  ```