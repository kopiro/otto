import ImageSearch from "../../lib/imagesearch";
import { rand } from "../../helpers";

export const id = "draw";

export default async function main({ queryResult }) {
  const { parameters: p } = queryResult;

  const images = await ImageSearch.search(`"${p.q}"`);
  const img = rand(images);

  return {
    payload: {
      image: {
        uri: img.url,
      },
    },
  };
}
