exports.id = 'draw';

const ImageSearch = require('../../lib/imagesearch');
const { rand } = require('../../helpers');

module.exports = async function main({ queryResult }) {
  const { parameters: p } = queryResult;

  const images = await ImageSearch.search(`"${p.q}"`);
  const img = rand(images);

  return {
    payload: {
      image: {
        uri: img.url,
      },
    },
  };
};
