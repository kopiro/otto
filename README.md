# Otto AI

[![Build Status](https://travis-ci.org/kopiro/otto-ai.svg?branch=master)](https://travis-ci.org/kopiro/otto-ai)

## Develop locally

```
docker-compose up
```

## Build for prod

```
npm run build
```

## Run in prod

```
npm run start
```

## Develop

### How to write an action

An action is a responder for an intent that has logic inside. 

Every action file must export a `Promise`.

The actions must be places in the `./src/actions` directory. If an action name is `hello.name`, the final file is `./src/actions/hello/name.js`.

For example, to write a simple action that respond hello.

```js
exports.id = 'hello.name';

module.exports = function({ sessionId, result }, session_model) {
    return new Promise((resolve, reject) => {
        let { parameters: p, fulfillment } = result;
        if (p.name == null) return reject();
        resolve({
            speech: `Hello ${p.name}!`
        })
    });
};
```

If a promise can't be fullfilled in less than 5 seconds (this is the API.AI timeout), you have to resolve it immediately, postponing eventuals outputs to the *IOManager*.

```js
exports.id = 'hello.postponed';

module.exports = function({ sessionId, result }, session_model) {
    return new Promise((resolve, reject) => {
        let { parameters: p, fulfillment } = result;
        resolve();
        doSomeLongWork(() => {
            IOManager.output({
                speech: 'Hello (postponed)'
            }, session_model);
        });
    });
};
```

### Action output payload

The output payload of an action could have these attributes:

Attribute | Description
--- | ---
`speech` | String that is spoken or written
`data.url` | URL
`data.media` | Media `{ artist: "", track: "", album: "" }`

### Customize messages

The file `messages.json` specify the messages used for certain actions.

To override some messages, place a `messages-custom.json` in the root directory.

