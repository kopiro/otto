exports.id = 'youtube.play';

const Youtube = requireLibrary('youtube');

module.exports = async function* ({ queryResult }, session) {
  const { parameters: p, fulfillmentText } = queryResult;

  yield {
    fulfillmentText,
    data: {
      feedback: true,
    },
  };

  const videos = await Youtube.searchVideos(p.q, 1);
  const video = videos[0];

  yield {
    payload: {
      video: {
        youtube: video,
      },
    },
  };
};
