# Otto AI

[![Build Status](https://travis-ci.org/kopiro/otto-ai.svg?branch=master)](https://travis-ci.org/kopiro/otto-ai)

![Logo](image.png?raw=true "Logo")

Otto was my monkey plush, now is my personal AI.

## Modes

Otto is a monolitich (by design) server and a client app with the same codebase.

It could run as a server to listen via webhook the incoming requests,
or it could run as a client to interact with the user via voice.

The flow is the following:

```
Request (client) --> [[ Dialogflow --> Server --> Fulfillment ]] --> Response (client)
```

## Build

### Build for production

```
npm run build
```

## Develop

### Run locally in server mode

Must have docker and docker-compose installed.

Just type:

```
docker-compose up
```

### Run locally in client mode

When running in client mode, you have to satisfy some dependencies that can be installed via a script based on your platform.

- _client_deps/macos.sh_ if you run on macOS
- _client_deps/raspberry.sh_ if you run on a Raspberry (2/3/Zero)

After that, just type:

```
npm run start
```

### I/O Drivers

I/O drivers are the the way the AI handles inputs and output.

Every I/O driver must expose these methods:

- `startInput` - To start receiving inputs
- `stopInput` - To stop receiving inputs
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
export OTTO_IO_DRIVERS=telegram,test
```

There are 4 I/O drivers available at the moment:

- **Test**: handle I/O using the CLI (used for test purposes)
- **Kid**: handle input using microphone and speech recognizer and output using a TTS via a speaker
- **Telegram**: handle I/O for a Telegram bot
- **Messenger**: handle I/O for a Facebook Messenger bot
- **Rest**: handle I/O via HTTP REST API (_work in progress_)

#### IO.Test

This driver spawn an Interactive CLI where you can write to test your AI.

To automate tests, you can put your messages in the `./etc/test.txt` file
separated by EOL. The CLI will send the lines on boot.

#### IO.Kid

This is the main I/O driver.

It uses your microphone to register your voice;
once it detects an hot word (example: _Hey BOT_),
it sends the stream through an online speech recognizer and return the speeech.

When you finish to talk, it sends the recognized speech over AI that could return
a output speech; it is sent over an online TTS to get an audio file that is played over the speaker.

Dependencies:

- **Snowboy** - for the hotword service
- **Google Cloud Speech Recognizer** - for the speech recognizer
- **AWS Polly** - for the TTS
- **Mopidy** - for the music playback

#### IO.Telegram

It listens via webhook (or via polling) the chat events of your Telegram bot,
send the text over AI that return an output.

The output is used to respond to the user request via Telegram.

Dependencies:

- **Google Cloud Speech Recognizer** - for the speech recognizer if the user send a voice message
- **AWS Polly** - for the TTS if we want to send a voice

#### IO.Messenger

It listens via webhook the chat events of your Facebook Messeger bot,
send the text over AI that return an output.

The output is used to respond to the user request via Facebook Messenger.

Dependencies:

- **Google Cloud Speech Recognizer** - for the speech recognizer if the user send a voice message
- **AWS Polly** - for the TTS if we want to send a voice

#### IO.Rest

It provides a clean HTTP REST interface to interact with the bot under the `/io/rest` URI.

Dependencies:

- **Google Cloud Speech Recognizer** - for the speech recognizer
- **AWS Polly** - for the TTS

For every request, you must provide a unique session ID via query string.

Query params:

- `sessionId`: required
- `outputType`: optional, define an additional output type (example: `voice`)

##### Send a text input

```sh
curl "http://${HOST}/io/rest?sessionId=${SESSION_ID}" -X POST --data "text=Hello"
```

```json
{
  "speech": "...",
  "data": {}
}
```

##### Send an audio input

You can send an audio file that will be recognized on-the-fly as a text.

```sh
curl "http://${HOST}/io/rest?sessionId=${SESSION_ID}" -X POST -F "audio=@${AUDIO_FILE}"
```

```json
{
  "speech": "...",
  "data": {}
}
```

##### Request a voice output

Append `outputType=voice` to the query string to request a voice file under the `voice` key.

```sh
curl "http://${HOST}/io/rest?sessionId=${SESSION_ID}&outputType=voice" -X POST --data "text=Hello"
```

```json
{
  "speech": "...",
  "data": {},
  "voice": "http://${HOST}/tmp/0000-00000-00000.mp3"
}
```

## Listeners

A listener is a file that listen for incoming requests and can trigger output.

## I/O Accessories

I/O Accessories are similar to drivers, but don't handle input and output direclty. They can be attached to I/O driver to perform additional things.

Accessories listen for I/O drivers events and, when an output to a driver is request, this output could be forwarded to accessories.

Each accessory has a method called `canHandleOutput` that should return constant from `IOManager.CAN_HANDLE_OUTPUT.*`:

- `YES_AND_BREAK`
- `YES_AND_CONTINUE`
- `NO`

Depending on this constant, the IOManager forward the output to the next configured driver or stops the chain.

You can temporary use a accessory without altering your configuration by setting an environment var:

```
export OTTO_IO_ACCESSORIES=telegram,test
```

### How to write an action

An action is a responder for an intent that has logic inside.

Your action parameters are:

- The API.AI (Dialogflow) object
- The mongoose _session_ for this request

Every action file must export a _Promise_ or an _Async Function (ES6)_.

#### Promise style

```js
exports.id = "hello.name";
module.exports = function({ sessionId, result }, session) {
  return new Promise((resolve, reject) => {
    let { parameters: p, fulfillment } = result;
    if (p.name) return reject("Invalid parameters");
    resolve(`Hello ${p.name}!`);
  });
};
```

#### Async style

```js
exports.id = "hello.name";
module.exports = async function({ sessionId, result }, session) {
  let { parameters: p, fulfillment } = result;
  if (p.name == null) throw "Invalid parameters";
  return {
    speech: `Hello ${p.name}!`
  };
};
```

#### Naming

The actions must be placed in the `./src/actions` directory.

If an action name is `hello.name`, the final file must be `./src/actions/hello/name.js`.

If an action name is `hello`, the final must be `./src/actions/hello/index.js`.

If a promise can't be fullfilled in less than 5 seconds (this is the API.AI timeout),
you have to resolve it immediately with the `feedback: true` key in `data`,
postponing an eventual output to the `IOManager.handle`.

```js
exports.id = "hello.postponed";

module.exports = async function({ sessionId, result }, session) {
  let { parameters: p, fulfillment } = result;

  doSomeLongWork(() => {
    IOManager.handle({
      fulfillment: {
        speech: `Hello ${p.name}! (postponed)`
      },
      session: session
    });
  });

  return {
    speech: "Wait for me...",
    data: {
      feedback: true
    }
  };
};
```

### Action output payload

The output payload of an action could have these attributes:

| Attribute        | Description                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `speech`         | String that could be spoken or written                                                        |
| `data.error`     | Error object to send. See below for the structure                                             |
| `data.language`  | Language override for speech. Default `session.getTranslateTo()`                              |
| `data.replies[]` | List of choices that the user can select. See below for the structure                         |
| `data.feedback`  | Boolean value indicating that this is temporary feedback until the real response will be sent |
| `data.url`       | URL to send or to open                                                                        |
| `data.music`     | Music to send or to play                                                                      |
| `data.game`      | Game that can be handled via Telegram                                                         |
| `data.video`     | Video to send or to show                                                                      |
| `data.audio`     | Audio to send or to show                                                                      |
| `data.image`     | Image to send or to show                                                                      |
| `data.lyrics`    | Lyrics object of a song                                                                       |
| `data.voice`     | Audio file to send or play via voice middlewares                                              |

#### `data.error`

| Attribute | Description                                         |
| --------- | --------------------------------------------------- |
| `speech`  | String representing a speechable error for the user |

#### `data.replies[]`

| Attribute | Description             |
| --------- | ----------------------- |
| `id`      | Unique ID of the choice |
| `text`    | String for the choice   |

#### `data.video`

| Attribute | Description                    |
| --------- | ------------------------------ |
| `uri`     | Absolute URI of the media      |
| `youtube` | Object containing Youtube data |

#### `data.image`

| Attribute | Description               |
| --------- | ------------------------- |
| `uri`     | Absolute URI of the media |

#### `data.audio`

| Attribute | Description               |
| --------- | ------------------------- |
| `uri`     | Absolute URI of the media |

#### `data.voice`

| Attribute | Description               |
| --------- | ------------------------- |
| `uri`     | Absolute URI of the media |

#### `data.lyrics`

| Attribute | Description                 |
| --------- | --------------------------- |
| `text`    | Lyrics (string) of the song |

#### `data.music`

| Attribute          | Description                                                                           |
| ------------------ | ------------------------------------------------------------------------------------- |
| `uri`              | Absolute URI of the media                                                             |
| `action`           | Action to execute to control playback. Can be `play`, `pause`, `next`, `prev`, `stop` |
| `spotify`          | Object containing Spotify data                                                        |
| `spotify.track`    | Spotify Track object                                                                  |
| `spotify.album`    | Spotify Album object                                                                  |
| `spotify.artist`   | Spotify Artist object                                                                 |
| `spotify.playlist` | Spotify Playlist object                                                               |

### Customize messages

The file `messages.json` specifies the messages used for certain actions.

To override some messages, place a `messages-custom.json` in the root directory.
