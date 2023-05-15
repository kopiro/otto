import camera from "./camera";

describe("Camera", () => {
  test("it works", async () => {
    const file = camera().takePhoto();
    console.debug("file", file);
  });
});
