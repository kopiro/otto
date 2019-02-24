exports.id = 'media.play';

module.exports = function () {
  return {
    payload: {
      media: {
        action: 'play',
      },
    },
  };
};
