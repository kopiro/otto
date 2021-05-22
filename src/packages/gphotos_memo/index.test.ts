import { ResponseBody } from "../../stdlib/ai";
import { Fulfillment } from "../../types";
import gPhotosMemo from "./index";

describe("Google Photo memories", () => {
  test("it returns a photo", async () => {
    // @ts-ignore
    const body = {
      queryResult: {
        fulfillmentText: "This is a memory",
        parameters: { album_link: "https://photos.app.goo.gl/TgSYhXBVD8bbt4xA9" },
      },
    } as ResponseBody;
    const fulfillment = (await gPhotosMemo(body)) as Fulfillment;
    expect(fulfillment.text).toBe("This is a memory");
    expect(fulfillment.payload.image.uri).toMatch(/^https:\/\//);
    expect(fulfillment.payload.image.caption).toMatch(/^https:\/\//);
  });
});
