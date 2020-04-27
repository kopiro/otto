# Otto AI

![Logo](image.png?raw=true "Logo")

Otto was my monkey plush, now is my personal AI assistant.

## Modes

The app is a monolitich (by design) server and a client app with the same codebase.

It could run as a server to listen via webhook the incoming requests,
or it could run as a client to interact with the user via voice.

## Development

#### Run with docker

```sh
docker-compose up
```

#### Run with naked NodeJS

```sh
yarn start:dev
```

#### Run client

When running in client mode, you have to satisfy some dependencies
that can be installed via a script based on your platform.

- _deps/macos.sh_ if you run on macOS
- _deps/raspberry.sh_ if you run on a Raspberry (2/3/Zero)

You can't run in client mode with Docker because some drivers require access
to microphone, speaker or other hardware peripherals.

Then:

```sh
yarn start:dev
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

```ts
export const id = "hello.name";
export async function main({ queryResult }, session) {
  let { parameters: p, queryText } = queryResult;
  if (p.name == null) throw "Invalid parameters";
  return `Hello ${p.name}!`;
}
```

#### Generator Function

```ts
export const id = "count.to";
export async function* main({ queryResult }, session) {
  let { parameters: p, queryText } = queryResult;
  for (let i = 1; i < Number(p.to); i++) {
    await timeout(1000);
    yield String(i);
  }
}
```

#### Naming

The actions must be placed in the `./src/packages` directory.

If an action name is `hello.name`, the final file must be `./src/actions/hello/name.js`;
shorter, if an action name is `hello`, the final must be `./src/actions/hello/index.js`.
