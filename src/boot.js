const path = require("path");
const config = require("./config");

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
  __dirname,
  "../keys/gcloud.json"
);
process.env.AWS_KEY_PATH = path.resolve(__dirname, "../keys/aws.json");

// Replace normal console with a better colorful console
require("console-ultimate/global").replace();

if (!config.uid) {
  console.error("Please define config.uid with your Universal ID (username)");
  process.exit(1);
}

if (config.raven && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line global-require
  require("raven")
    .config(config.raven)
    .install();
}
