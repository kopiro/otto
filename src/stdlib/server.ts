import http from "http";
import express from "express";
import bodyParser from "body-parser";
import config from "../config";
import { publicDir } from "../paths";
import { webhookEndpoint } from "./ai";

const TAG = "Server";

const _config = config().server;

export const app = express();
export const server = http.createServer(app);

// Routers

export const routerIO = express.Router();
export const routerApi = express.Router();
export const routerListeners = express.Router();

// API Router

routerApi.use(bodyParser.json());
routerApi.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

// Add the fulfillment endpoint for Dialogflow
routerApi.post("/fulfillment", webhookEndpoint);

// Listeners

routerListeners.use(bodyParser.json());
routerListeners.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

// IO

routerIO.use(bodyParser.json());
routerIO.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

app.use(express.static(publicDir));

// Handle all routers
app.use("/io", routerIO);
app.use("/api", routerApi);
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
