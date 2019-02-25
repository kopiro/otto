require("../boot");
const Camera = requireLibrary("camera");
async function main() {
  const video_file = await Camera.recordVideo({
    time: 3
  });
  console.log(video_file);
}
main();
