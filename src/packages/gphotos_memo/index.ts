import { AIAction, Fulfillment } from "../../types";
import fetch from "node-fetch";
import cheerio, { Element } from "cheerio";

const gPhotosMemo: AIAction = async ({ queryResult }): Promise<Fulfillment> => {
  const { album_link: albumLink } = queryResult.parameters;
  const $ = cheerio.load(await (await fetch(albumLink)).text());
  const images = $("a>img")
    .toArray()
    .map((e) => ({
      src: e.attribs["src"],
      link: `https://photos.google.com${(e.parent as Element).attribs["href"].replace("./", "/")}`,
    }));
  const image = images[Math.floor(Math.random() * images.length)];

  return {
    text: queryResult.fulfillmentText,
    payload: {
      image: {
        uri: image.src,
        caption: image.link,
      },
    },
  };
};

export default gPhotosMemo;
