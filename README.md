# Otto AI

[![Build Status](https://travis-ci.org/kopiro/otto-ai.svg?branch=master)](https://travis-ci.org/kopiro/otto-ai)

![Logo](image.png?raw=true 'Logo')

Otto was my monkey plush, now is my personal AI assistant.

## Modes

The app is a monolitich (by design) server and a client app with the same codebase.

It could run as a server to listen via webhook the incoming requests,
or it could run as a client to interact with the user via voice.

The flow is the following:

```
Request (client) --> [[ Dialogflow --> Server --> Fulfillment ]] --> Response (client)
```

## Development

#### Run with docker

```sh
docker-compose up
```

#### Run with naked NodeJS

```sh
yarn dev
```

#### Run client

When running in client mode, you have to satisfy some dependencies
that can be installed via a script based on your platform.

- _client_deps/macos.sh_ if you run on macOS
- _client_deps/raspberry.sh_ if you run on a Raspberry (2/3/Zero)

You can't run in client mode with Docker because some drivers require access
to microphone, speaker or other hardware peripherals.

Then:

```sh
yarn dev
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
export OTTO_IO_DRIVERS="telegram,test"
```

There are 4 I/O drivers available at the moment:

- **Human**: handle input using microphone and speech recognizer and output using a TTS via a speaker
- **Telegram**: handle I/O for a Telegram bot
- **Web**: handle I/O via Socket.IO

#### IO.Human

This is the main I/O driver.

It uses your microphone to register your voice;
once it detects an hot word (example: _Hey BOT_),
it sends the stream through an online speech recognizer and return the speeech.

When you finish to talk, it sends the recognized speech over AI that could return
a output speech; it is sent over an online TTS to get an audio file that is played over the speaker.

Optional dependencies:

- **Snowboy** - for the hotword service

#### IO.Telegram

It listens via webhook (or via polling) the chat events of your Telegram bot,
send the text over AI that return an output.

The output is used to respond to the user request via Telegram.

#### IO.Web

It provides a clean Socket.IO interface to interact with the bot.

For every request, you must provide a unique session ID.

Params:

- `sessionId`: required
- `outputType`: optional, define an additional output type (example: `voice`)

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

There is a main difference in actions.

If an action has _one_ return value, it should be a **Function** or,
if you need to do async requests, a **Promise / AsyncFunction**.

Otherwise, if an action return multiple values _over time_, it should be a **Generator / AsyncGenerator**.

#### Promise/Async Function

```js
exports.id = 'hello.name';
module.exports = async function main({ queryResult }, session) {
  let { parameters: p, queryText } = queryResult;
  if (p.name == null) throw 'Invalid parameters';
  return `Hello ${p.name}!`;
};
```

#### Generator Function

```js
exports.id = 'count.to';
module.exports = async function* main({ queryResult }, session) {
  let { parameters: p, queryText } = queryResult;
  for (let i = 1; i < Number(p.to); i++) {
    await timeout(1000);
    yield String(i);
  }
};
```

#### Naming

The actions must be placed in the `./src/actions` directory.

If an action name is `hello.name`, the final file must be `./src/actions/hello/name.js`;
shorter, if an action name is `hello`, the final must be `./src/actions/hello/index.js`.

### Action output payload

The output payload of an action could have these attributes:

| Attribute              | Description                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `speech`               | String that could be spoken or written                                                        |
| `payload.language`     | Language override for speech. Default `session.getTranslateTo()`                              |
| `payload.replies[]`    | List of choices that the user can select. See below for the structure                         |
| `payload.feedback`     | Boolean value indicating that this is temporary feedback until the real response will be sent |
| `payload.includeVoice` | Boolean value indicating that an additional voice note along text should be sent              |
| `payload.url`          | URL to send or to open                                                                        |
| `payload.music`        | Music to send or to play                                                                      |
| `payload.video`        | Video to send or to show                                                                      |
| `payload.audio`        | Audio to send or to show                                                                      |
| `payload.image`        | Image to send or to show                                                                      |
| `payload.voice`        | Audio file to send or play via voice middlewares                                              |
| `payload.game`         | Game that can be handled via Telegram                                                         |

#### `payload.replies[]`

| Attribute | Description             |
| --------- | ----------------------- |
| `id`      | Unique ID of the choice |
| `text`    | String for the choice   |

#### `payload.video`

| Attribute | Description                    |
| --------- | ------------------------------ |
| `uri`     | Absolute URI of the media      |
| `youtube` | Object containing Youtube data |

#### `payload.image`

| Attribute | Description               |
| --------- | ------------------------- |
| `uri`     | Absolute URI of the media |

#### `payload.audio`

| Attribute | Description               |
| --------- | ------------------------- |
| `uri`     | Absolute URI of the media |

#### `payload.voice`

| Attribute | Description               |
| --------- | ------------------------- |
| `uri`     | Absolute URI of the media |

#### `payload.music`

| Attribute          | Description                                                                           |
| ------------------ | ------------------------------------------------------------------------------------- |
| `uri`              | Absolute URI of the media                                                             |
| `action`           | Action to execute to control playback. Can be `play`, `pause`, `next`, `prev`, `stop` |
| `spotify`          | Object containing Spotify data                                                        |
| `spotify.track`    | Spotify Track object                                                                  |
| `spotify.album`    | Spotify Album object                                                                  |
| `spotify.artist`   | Spotify Artist object                                                                 |
| `spotify.playlist` | Spotify Playlist object                                                               |
| `spotify.tracks`   | List of Spotify tracks                                                                |

### Configuration keys

#### First level keys

| Key              | Description                                      | Default value | Required | Type     |
| ---------------- | ------------------------------------------------ | ------------- | -------- | -------- |
| uid              | Name of current AI instance                      | null          | yes      | String   |
| aiNameRegex      | Regex used to wakeup the AI in groups chats      |               | yes\*    | String   |
| ioDrivers        | List of IO drivers to load                       | []            | yes\*    | String[] |
| language         | The source language of the AI                    | en            | no       | String   |
| ioAccessoriesMap | Map with driver: list accessories                | {}            | no       | String{} |
| listeners        | List of listeners to load                        | []            | no       | String[] |
| ioRedirectMap    | Redirection map with input driver: output driver | {}            | no       | String{} |
| scheduler        | On/Off the scheduler                             | true          | no       | Bool     |
| serverMode       | On/Off the server mode                           | false         | no       | Bool     |
| raven            | Sentry DSN                                       | null          | no       | String   |

#### Play

| Key          | Description                                 | Default value | Required | Type     |
| ------------ | ------------------------------------------- | ------------- | -------- | -------- |
| play.addArgs | Additional CLI args to send to Play program | []            | no       | String[] |

#### Snowboy

| Key                      | Description                                       | Default value | Required | Type   |
| ------------------------ | ------------------------------------------------- | ------------- | -------- | ------ |
| snowboy.apiKey           | Snowboy API key to record new speechs for hotword | null          | yes\*    | String |
| snowboy.sensitivity.wake | Sensitivity param for Snowboy wake hotword        | 0.4           | no       | Number |
| snowboy.sensitivity.stop | Sensitivity param for Snowboy stop hotword        | 0.4           | no       | Number |

#### Server

| Key           | Description                                          | Default value | Required | Type   |
| ------------- | ---------------------------------------------------- | ------------- | -------- | ------ |
| server.domain | HTTP domain for the server (used for absolute links) | null          | yes\*    | String |
| server.port   | HTTP port for the server                             | 8080          | no       | Number |
| server.port   | HTTP port for the server                             | 8080          | no       | Number |

#### Mongo

| Key            | Description                     | Default value | Required | Type   |
| -------------- | ------------------------------- | ------------- | -------- | ------ |
| mongo.host     | Host for DB connection          | db            | yes      | String |
| mongo.port     | Port for DB connection          | 27017         | yes      | Number |
| mongo.database | Database name for DB connection | admin         | yes      | String |
| mongo.user     | User for DB connection          | admin         | yes      | String |
| mongo.password | Password for DB connection      | null          | yes      | String |

#### APIAI (Dialogflow)

| Key                 | Description                                      | Default value | Required | Type   |
| ------------------- | ------------------------------------------------ | ------------- | -------- | ------ |
| apiai.token         | API.AI/Dialogflow API key (client token)         | null          | yes      | String |
| apiai.actionTimeout | Specify after how many seconds an action expires | 10            | no       | Number |

#### Telegram (IO driver)

| Key              | Description                            | Default value    | Required | Type   |
| ---------------- | -------------------------------------- | ---------------- | -------- | ------ |
| telegram.token   | Token used to instantiate Telegram bot | null             | yes\*    | String |
| telegram.options | Options passed to TelegramBot library  | { polling: true} | yes\*    | Object |

#### Human (IO Driver)

| Key | Description | Default value | Required | Type |
| --- | ----------- | ------------- | -------- | ---- |


#### Facebook (Library)

| Key                  | Description                        | Default value | Required | Type   |
| -------------------- | ---------------------------------- | ------------- | -------- | ------ |
| facebook.appId       | Application ID                     | null          | yes\*    | String |
| facebook.secret      | Application secret                 | null          | yes\*    | String |
| facebook.pageId      | Facebook Page ID                   | null          | yes\*    | String |
| facebook.accessToken | Static page-token used to call API | null          | yes\*    | String |

#### AWS (Library)

| Key              | Description         | Default value | Required | Type        |
| ---------------- | ------------------- | ------------- | -------- | ----------- |
| aws.polly.gender | Gender used for TTS | Female        | no       | Male/Female |

#### GCloud (Library)

| Key                   | Description                      | Default value | Required | Type        |
| --------------------- | -------------------------------- | ------------- | -------- | ----------- |
| gcloud.cseId          | Application ID                   | null          | yes\*    | String      |
| gcloud.apiKey         | Application key                  | null          | yes\*    | String      |
| gcloud.storage.bucket | Google Cloud Storage bucket name | null          | yes\*    | String      |
| gcloud.tts.gender     | Gender used for TTS              | Female        | no       | Male/Female |

#### Transmission (Library)

| Key                   | Description                            | Default value | Required | Type   |
| --------------------- | -------------------------------------- | ------------- | -------- | ------ |
| transmission.host     | Host of your Transmission instance     | null          | yes\*    | String |
| transmission.port     | Port of your Transmission instance     | null          | yes\*    | Number |
| transmission.username | Username of your Transmission instance | null          | yes\*    | String |
| transmission.password | Password of your Transmission instance | null          | yes\*    | String |
| transmission.ssl      | On/Off SSL to connect                  | false         | no       | Bool   |

yes\* = (yes if you use that service)
