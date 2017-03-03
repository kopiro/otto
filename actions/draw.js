const _config = config.ai.gcloud;
const TAG = path.basename(__filename, '.js');

const ImagesClient = require('google-images');
const client = new ImagesClient(_config.cseId, _config.apiKey);

module.exports = function(e) {
    return new Promise((resolve, reject) => {
        console.debug(TAG, e);
        let { parameters, fulfillment } = e;

        client.search(`disegno "${parameters.thing}"`)
        .then((images) => {
            let img = images[_.random(0, images.length-1)];
            console.debug(TAG, 'result', img);
            resolve({
                photo: {
                    remoteFile: img.url
                }
            });
        })
        .catch((err) => {
            reject(err);
        });
    });
};

