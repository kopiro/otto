const TAG = 'AI.searchImage';
const _config = config.ai.gcloud;

const ImagesClient = require('google-images');
const client = new ImagesClient(_config.cseId, _config.apiKey);

module.exports = function(e) {
    return new Promise((resolve, reject) => {
        console.debug(TAG, JSON.stringify(e, null, 2));
        let { parameters, fulfillment } = e;

        client.search('disegno bambino ' + parameters.thing)
        .then((images) => {
            console.debug(images);
            let img = images[_.random(0, images.length-1)];
            resolve({
                image: img.url
            });
        })
        .catch((err) => {
            reject(err);
        });
    });
};

