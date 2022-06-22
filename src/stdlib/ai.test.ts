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
                  // @ts-ignore
                  kind: "stringValue",
                },
              },
            },
            message: "payload",
          },
        ],
        "audio",
      ),
    ).toMatch("URL");
  });
});
