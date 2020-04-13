import Camera from "./camera";

describe("Camera", () => {
  test("it works", async () => {
    const file = Camera.takePhoto();
    console.log("file", file);
  });
});
