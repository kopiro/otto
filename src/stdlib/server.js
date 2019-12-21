const http = require("http");
const socketio = require("socket.io");
const express = require("express");
const bodyParser = require("body-parser");
const config = require("../config");
const pack = require("../../package.json");
const { tmpDir } = require("../paths");

const TAG = "Server";

const _config = config.server;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.set("title", pack.name);

function getAbsoluteURIByRelativeURI(link) {
  return _config.domain + link;
}

function getURIFromFSFilePath(file) {
  if (file.indexOf(tmpDir) !== -1) {
    file = file.replace(tmpDir, "/tmp");
  }
  return _config.domain + file;
}

// Routers

const routerIO = express.Router();
const routerApi = express.Router();
const routerActions = express.Router();
const routerListeners = express.Router();

// API Router

routerApi.use(bodyParser.json());
routerApi.use(
  bodyParser.urlencoded({
    extended: true
  })
);

routerApi.get("/", (req, res) => {
  res.json({
    name: pack.name,
    version: pack.version
  });
});

// Listeners

routerListeners.use(bodyParser.json());
routerListeners.use(
  bodyParser.urlencoded({
    extended: true
  })
);

// public
app.use("/tmp", express.static(tmpDir));

// Handle all routers
app.use("/io", routerIO);
app.use("/api", routerApi);
app.use("/actions", routerActions);
app.use("/listeners", routerListeners);

// Adding policy URL
app.get("/policy", (req, res) => {
  res.end(
    "This bot is used only for fun, it's our monkey plush. It only answers to basic questions."
  );
});

function start() {
  server.listen(
    {
      port: _config.port,
      server: "0.0.0.0"
    },
    () => {
      console.info(TAG, `started: http://0.0.0.0:${_config.port}`);
    }
  );
}

module.exports = {
  getAbsoluteURIByRelativeURI,
  getURIFromFSFilePath,
  routerIO,
  routerApi,
  routerActions,
  routerListeners,
  io,
  app,
  start
};
