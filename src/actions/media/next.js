exports.id = 'media.next';

module.exports = function () {
  return {
    payload: {
      media: {
        action: 'next',
      },
    },
  };
};
