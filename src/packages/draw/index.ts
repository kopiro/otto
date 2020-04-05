import { client } from "../../lib/imagesearch";
import { rand } from "../../helpers";

export const id = "draw";

export default async function main({ queryResult }) {
  const { parameters: p } = queryResult;

  const images = await client.search(`"${p.q}"`);
  const img = rand(images);

  return {
    payload: {
      image: {
        uri: img.url,
      },
    },
  };
}
