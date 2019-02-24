exports.id = 'media.pause';

module.exports = function () {
  return {
    payload: {
      media: {
        action: 'pause',
      },
    },
  };
};
