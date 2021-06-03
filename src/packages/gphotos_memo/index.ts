import { AIAction, Fulfillment } from "../../types";
import gogleOAuthService from "../../oauth-services/google";
import fetch from "node-fetch";
import { shuffle } from "../../lib/ utils";
import moment from "../../lib/moment";

const POLL_DATE_CHOICES_COUNT = 4;
const POLL_DATE_RANGE_DAYS = 1460;
const POLL_DATE_ANSWER_MINUTES = 10;

const gPhotosMemoAction: AIAction = async ({ queryResult }, session) => {
  const { parameters: p } = queryResult;

  const token = await gogleOAuthService().getAccessToken();

  // // De-comment this to have the full list
  // const albumsResponse = await fetch("https://photoslibrary.googleapis.com/v1/sharedAlbums", {
  //   headers: {
  //     authorization: `Bearer ${token}`,
  //   },
  // });
  // const albumsResponseJson = await albumsResponse.json();

  const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      pageSize: 100,
      albumId: p.album_id,
    }),
  });
  const responseJson = await response.json();

  const images = responseJson.mediaItems.filter((e) => e.mimeType.includes("image"));
  const media = images[Math.floor(Math.random() * images.length)];
  const url = `${media.baseUrl}=w2000-h2000`;

  const fulfillment: Fulfillment = {
    payload: {
      image: {
        uri: url,
        caption: queryResult.fulfillmentText,
      },
    },
  };

  const pollDateQuestion: string = p.poll_date_question;
  if (pollDateQuestion) {
    const creationTime = moment()(media.mediaMetadata?.creationTime);
    if (creationTime.isValid()) {
      const creationTimeStr = creationTime.format("LL");
      const choices = [creationTimeStr];

      const pollDateAnswer = (p.poll_date_answer || "").replace("%date%", creationTimeStr);
      const pollDateChoicesCount = Number(p.poll_date_choices_count) || POLL_DATE_CHOICES_COUNT;
      const pollDateRangeDays = Number(p.poll_date_range_days) || POLL_DATE_RANGE_DAYS;
      const pollDateAnswerMinutes = Number(p.poll_date_answer_minutes) || POLL_DATE_ANSWER_MINUTES;

      // Make sure we don't go into the future
      const daysFromNow = moment()().diff(creationTime, "days");
      const dateRangeDays = Math.min(daysFromNow / 2, pollDateRangeDays);

      for (let i = 0; i < pollDateChoicesCount; i++) {
        const randomDate = creationTime
          .clone()
          .add(-dateRangeDays + Math.floor(Math.random() * dateRangeDays * 2), "days")
          .format("LL");
        choices.push(randomDate);
      }
      shuffle(choices);

      const pollCloseAt = moment()().add(pollDateAnswerMinutes, "minutes");

      fulfillment.payload.poll = {
        question: pollDateQuestion,
        choices,
        is_anonymous: false,
        type: "quiz",
        allows_multiple_answers: false,
        correct_option_id: choices.findIndex((e) => e === creationTimeStr),
        explanation: pollDateAnswer,
        close_date: pollCloseAt.unix(),
      };

      // setImmediate(() => {
      //   scheduler().scheduleFulfillment(
      //     {
      //       text: pollDateAnswer,
      //     },
      //     session,
      //     pollCloseAt.toDate(),
      //   );
      // });
    }
  }

  return fulfillment;
};

export default gPhotosMemoAction;
