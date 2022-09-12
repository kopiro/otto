import { Struct } from "pb-util/build";
import AI from "./ai";

describe("AI", () => {
  test("extractMessages", async () => {
    expect(
      AI().extractMessages(
        [
          {
            platform: "PLATFORM_UNSPECIFIED",
            payload: {
              fields: {
                audio: {
                  stringValue: "URL",
                  kind: "stringValue",
                },
              },
            } as Struct,
          },
        ],
        "audio",
      ),
    ).toMatch("URL");
  });
});
