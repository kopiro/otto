import { AIAction } from "../../types";
import gogleOAuthService from "../../oauth-services/google";
import { ResponseBody } from "../../stdlib/ai";
import fetch from "node-fetch";
import { shuffle } from "../../lib/ utils";

const gPhotosMemoAction: AIAction = async ({ queryResult }) => {
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
      albumId: queryResult.parameters.album_id,
    }),
  });
  const responseJson = await response.json();

  const images = responseJson.mediaItems.filter((e) => /image/.test(e.mimeType));
  shuffle(images);

  // Since Math.random is failing at me, let's do an incremental circular sequence based on the day since 1970
  const index = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % images.length;
  const media = images[index];
  const url = `${media.baseUrl}=w2000-h2000`;

  return {
    payload: {
      image: {
        uri: url,
        caption: queryResult.fulfillmentText,
      },
    },
  };
};

if (process.env.RUN_ACTION === "1") {
  (async () => {
    const data = await gPhotosMemoAction(({
      queryResult: {
        parameters: {
          album_id: "",
        },
      },
    } as unknown) as ResponseBody);
    console.log(data);
  })();
}

export default gPhotosMemoAction;
