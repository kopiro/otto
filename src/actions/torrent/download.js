exports.id = 'torrent.download';

const _ = require('underscore');

const TorrentSE = require('../../lib/torrent/se');
const Transmission = require('../../lib/transmission');
const { promisify } = require('util');

const pendingQueue = {};
const CONTEXT_MULTIPLE_ITEMS = 'torrent_multipleitems';

module.exports = async function* ({ queryResult }, session) {
  const {
    parameters: p, queryText, fulfillmentText, fulfillmentMessages,
  } = queryResult;

  let torrents;

  if (p.multipleItems != null) {
    // If we have a multi-choice, extract from previous queue
    let index = 1;
    const answer = pendingQueue[session._id].find(
      torrent => torrent.title === queryText || String(index++) == queryText,
    );
    if (answer == null) throw 'not_found';
    torrents = [answer];
  } else {
    // Do a full search
    yield {
      fulfillmentText: extractWithPattern(fulfillmentMessages, '[].payload.text.loading'),
      payload: {
        feedback: true,
      },
    };

    torrents = await TorrentSE.query(p.q);
  }

  if (torrents.length === 0) {
    throw 'not_found';
  } else if (torrents.length === 1) {
    // If list is one value, instant resolve!
    // This could happen if the user is very specific about something
    // or if the context of multiple items is set
    yield new Promise((resolve, reject) => {
      Transmission.addUrl(torrents[0].magnet, {}, (err) => {
        if (err) reject(err);
        resolve(fulfillmentText.replace('$_title', torrents[0].title));
      });
    });
  } else {
    pendingQueue[session._id] = torrents;
    yield {
      fulfillmentText: torrents.map((e, i) => `${i + 1} - ${e.title}`).join('\n'),
      outputContexts: [{ name: CONTEXT_MULTIPLE_ITEMS, lifespanCount: 1 }],
      payload: {
        replies: torrents.map((e, i) => String(i + 1)),
      },
    };
  }
};
