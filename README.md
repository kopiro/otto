# Otto AI

[![Build Status](https://travis-ci.org/kopiro/otto-ai.svg?branch=master)](https://travis-ci.org/kopiro/otto-ai)

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

* *client_deps/macos.sh* if you run on macOS
* *client_deps/raspberry.sh* if you run on a Raspberry (2/3/Zero)

After that, just type:

```
npm run start
```

### How to write an action

An action is a responder for an intent that has logic inside. 

Your action parameters are:

* The API.AI (Dialogflow) object
* The mongoose *session_model* for this request

Every action file must export a *Promise* or an *Async Function (ES6)*.

#### Promise style

```js
exports.id = 'hello.name';
module.exports = function({ sessionId, result }, session_model) {
    return new Promise((resolve, reject) => {
        let { parameters: p, fulfillment } = result;
        if (p.name) return reject('Invalid parameters');
        resolve(`Hello ${p.name}!`);
    });
};
```

#### Async style

```js
exports.id = 'hello.name';
module.exports = async function({ sessionId, result }, session_model) {
    let { parameters: p, fulfillment } = result;
    if (p.name == null) throw 'Invalid parameters';
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
you have to resolve it immediately, postponing an eventual output to the *IOManager*.

```js
exports.id = 'hello.postponed';

module.exports = async function({ sessionId, result }, session_model) {
    let { parameters: p, fulfillment } = result;

    doSomeLongWork(() => {
        IOManager.output({
            speech: `Hello ${p.name}! (postponed)`
        }, session_model);
    });

    return {
        speech: 'Wait for me...',
        data: {
            feedback: true
        }
    };
};
```

### Action output payload

The output payload of an action could have these attributes:

Attribute | Description
--- | ---
`speech` | String that could be spoken or written
`data.error` | Error object to send. See below for the structure
`data.language` | Language override for speech. Default `session.getTranslateTo()`
`data.replies[]` | List of choices that the user can select. See below for the structure
`data.url` | URL to send or to open
`data.music` | Music to send or to play. See below for the structure
`data.feedback` | Boolean value indicating that this is temporary feedback until the real response will be sent
`data.game` | Game that can be handled via Telegram. See below for the structure
`data.video` | Video to send or to show. See below for the structure
`data.audio` | Audio to send or to show. See below for the structure
`data.image` | Image to send or to show. See below for the structure
`data.lyrics` | Lyrics object of a song. See below for the structure
`data.voice` | Audio file to send or play via voice middlewares

#### `data.error`

Attribute | Description
--- | ---
`speech` | String representing a speechable error for the user

#### `data.replies[]`

Attribute | Description
--- | ---
`id` | Unique ID of the choice
`text` | String for the choice

#### `data.video`

Attribute | Description
--- | ---
`uri` | Absolute URI of the media

#### `data.image`

Attribute | Description
--- | ---
`uri` | Absolute URI of the media

#### `data.audio`

Attribute | Description
--- | ---
`uri` | Absolute URI of the media

#### `data.voice`

Attribute | Description
--- | ---
`uri` | Absolute URI of the media

#### `data.lyrics`

Attribute | Description
--- | ---
`text` | Lyrics (string) of the song

#### `data.music`

Attribute | Description
--- | ---
`action` | Action to execute to control playback. Can be `play`, `pause`, `next`, `prev`, `stop`
`track` | Track object. See below for the structure
`album` | Album object. See below for the structure
`artist` | Artist object. See below for the structure
`playlist` | Playlist object. See below for the structure

#### `data.music.track`

Attribute | Description
--- | ---
`uri` | Absolute URI to send or to play
`share_url` | Share URL for this object

#### `data.music.album`

Attribute | Description
--- | ---
`uri` | Absolute URI to send or to play
`share_url` | Share URL for this object

#### `data.music.artist`

Attribute | Description
--- | ---
`uri` | Absolute URI to send or to play
`share_url` | Share URL for this object

#### `data.music.playlist`

Attribute | Description
--- | ---
`uri` | Absolute URI to send or to play
`share_url` | Share URL for this object

### Customize messages

The file `messages.json` specifies the messages used for certain actions.

To override some messages, place a `messages-custom.json` in the root directory.

