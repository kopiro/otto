const TAG = 'AI.searchImage';
const _config = config.ai.gcloud;

const ImagesClient = require('google-images');
const client = new ImagesClient(_config.cseId, _config.apiKey);

module.exports = function(e) {
    return new Promise((resolve, reject) => {
        console.debug(TAG, JSON.stringify(e, null, 2));
        let { parameters } = e;

        client.search('kid drawing ' + parameters.thing)
        .then((images) => {
            resolve( images[_.random(0, images.length-1)].url );
        })
        .catch((err) => {
            reject(err);
        });
    });
};

