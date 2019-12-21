exports.id = "key_button";

const keypress = require("keypress");

exports.canHandleOutput = () => false;

exports.attach = io => {
  keypress(process.stdin);

  process.stdin.on("keypress", (ch, key) => {
    if (key && key.name === "enter") {
      io.emitter.emit("wake");
    }
  });
};
