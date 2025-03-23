// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

module.exports = {
  mode: process.env.NODE_ENV,
  entry: {
    index: "./index.ts",
    admin: "./admin.ts",
  },
  output: {
    path: path.resolve(__dirname, "..", "public", "build"),
    filename: "[name].js",
    publicPath: "/",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          configFile: path.resolve(__dirname, "tsconfig.json"),
        },
      },
    ],
    /* Advanced module configuration (click to show) */
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  devtool: process.env.NODE_ENV === "development" ? "source-map" : false,
  context: __dirname,
  target: "web",
};
