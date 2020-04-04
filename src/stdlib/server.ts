import http from "http";
import express from "express";
import bodyParser from "body-parser";
import config from "../config";
import { tmpDir } from "../paths";
import * as pack from "../../package.json";

const TAG = "Server";

const _config = config().server;

const app = express();
const server = http.createServer(app);

app.set("title", pack.name);

// Routers

export const routerIO = express.Router();
export const routerApi = express.Router();
export const routerActions = express.Router();
export const routerListeners = express.Router();

// API Router

routerApi.use(bodyParser.json());
routerApi.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

routerApi.get("/", (req, res) => {
  res.json({
    name: pack.name,
    version: pack.version,
  });
});

// Listeners

routerListeners.use(bodyParser.json());
routerListeners.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

// Handle all routers
app.use("/io", routerIO);
app.use("/api", routerApi);
app.use("/actions", routerActions);
app.use("/listeners", routerListeners);

// Adding policy URL
app.get("/policy", (req, res) => {
  res.end("This bot is used only for fun, it's our monkey plush. It only answers to basic questions.");
});

export function start() {
  server.listen(
    {
      port: _config.port,
      server: "0.0.0.0",
    },
    () => {
      console.info(TAG, `started: http://0.0.0.0:${_config.port}`);
    },
  );
}
