import { AIAction } from "../../types";
import gogleOAuthService from "../../oauth-services/google";
import { ResponseBody } from "../../stdlib/ai";
import fetch from "node-fetch";

const gPhotosMemoAction: AIAction = async ({ queryResult }) => {
  const token = await gogleOAuthService().getAccessToken();

  // De-comment this to have the full list
  const albumsResponse = await fetch("https://photoslibrary.googleapis.com/v1/sharedAlbums", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const albumsResponseJson = await albumsResponse.json();
  console.log(`albumsResponseJson`, albumsResponseJson);

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
  // Since Math.random is failing at me, let's do an incremental circular sequence based on the day since 1970
  const index = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % images.length;
  const media = images[index];

  return {
    payload: {
      image: {
        uri: media.baseUrl,
        caption: queryResult.fulfillmentText,
      },
    },
  };
};

if (process.env.RUN_ACTION === "1") {
  gPhotosMemoAction(({
    queryResult: {
      parameters: {
        album_id: "AGXs7FJLS7pM_-Xk4XaRZE3icyWLUYtpY-SIM-gVsYAWHeHxqc-LwrvyyLvAhUQcyQiJmE6IQCCKZmWt5OzTk63FojNWm9HEFw",
      },
    },
  } as unknown) as ResponseBody);
}

export default gPhotosMemoAction;
