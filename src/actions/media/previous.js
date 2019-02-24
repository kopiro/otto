exports.id = 'media.previous';

module.exports = function () {
  return {
    payload: {
      media: {
        action: 'previous',
      },
    },
  };
};
