exports.id = 'knowledge.get';

const Wolfram = require('../../lib/wolfram');
const Translator = require('../../lib/translator');
const { promisify } = require('util');

module.exports = async function* ({ queryResult }, session) {
  const { parameters: p, fulfillmentText } = queryResult;

  yield {
    fulfillmentText,
    payload: {
      feedback: true,
    },
  };

  // Translate to EN (the only language that Wolfram accept)
  const query = await Translator.translate(p.q, 'en', null);
  const result = await Wolfram.query(query);

  if (result.queryresult == null || result.queryresult.pod == null) {
    throw 'not_found';
  }

  for (const pod of result.queryresult.pod) {
    if (pod.$.error === 'true') continue;
    if (pod.$.id === 'Input') continue;

    yield await Translator.translate(pod.$.title, session.getTranslateTo(), 'en');

    for (const subpod of pod.subpod) {
      if (subpod.plaintext && subpod.plaintext.length > 0 && subpod.plaintext[0] != '') {
        yield await Translator.translate(
          subpod.plaintext.join('\n'),
          session.getTranslateTo(),
          'en',
        );
      } else if (subpod.imagesource && subpod.imagesource.length > 0) {
        for (const img of subpod.imagesource || []) {
          yield {
            payload: {
              image: {
                uri: img,
              },
            },
          };
        }
      } else if (subpod.img && subpod.img.length > 0) {
        for (const img of subpod.img || []) {
          yield {
            payload: {
              image: {
                uri: img.$.src,
              },
            },
          };
        }
      }
    }
  }
};
