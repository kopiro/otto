import { rand } from "../../helpers";
import imageSearch from "../../lib/image-search";

export const id = "draw";

export default async function main({ queryResult }) {
  const { parameters: p } = queryResult;

  const images = await imageSearch().search(`"${p.q}"`);
  const img = rand(images);

  return {
    payload: {
      image: {
        uri: img.url,
      },
    },
  };
}
