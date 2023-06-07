import { AIAction, Fulfillment } from "../../types";
import gogleOAuthService from "../../oauth-services/google";
import fetch from "node-fetch";
import moment from "../../lib/moment";
import { shuffle } from "../../helpers";

const POLL_DATE_CHOICES_COUNT = 4;
const POLL_DATE_RANGE_DAYS = 1460;
const POLL_DATE_ANSWER_MINUTES = 10;

export const id = "gphotos_memo";

const gPhotosMemoAction: AIAction = async ({ queryResult }) => {
  const { parameters: p } = queryResult || {};

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
      albumId: p?.fields?.album_id?.stringValue,
    }),
  });
  const responseJson = (await response.json()) as {
    mediaItems: { mimeType: string; baseUrl: string; mediaMetadata?: { creationTime: string } }[];
  };

  const images = responseJson.mediaItems.filter((e) => e.mimeType.includes("image"));
  const media = images[Math.floor(Math.random() * images.length)];
  const url = `${media.baseUrl}=w2000-h2000`;

  const fulfillment: Fulfillment = {
    image: url,
    caption: queryResult?.fulfillmentText || "",
  };

  const pollDateQuestion: string = p?.fields?.poll_date_question.stringValue || "";
  if (pollDateQuestion) {
    const creationTime = moment()(media.mediaMetadata?.creationTime);
    if (creationTime.isValid()) {
      const creationTimeStr = creationTime.format("LL");
      const choices = [creationTimeStr];

      const pollDateAnswer = (p?.fields?.poll_date_answer.stringValue || "").replace("%date%", creationTimeStr);
      const pollDateChoicesCount = Number(p?.fields?.poll_date_choices_count.stringValue) || POLL_DATE_CHOICES_COUNT;
      const pollDateRangeDays = Number(p?.fields?.poll_date_range_days.stringValue) || POLL_DATE_RANGE_DAYS;
      const pollDateAnswerMinutes = Number(p?.fields?.poll_date_answer_minutes.stringValue) || POLL_DATE_ANSWER_MINUTES;

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

      fulfillment.poll = {
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
