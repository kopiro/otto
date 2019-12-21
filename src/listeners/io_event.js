const Server = require("../stdlib/server");
const AI = require("../stdlib/ai");
const IOManager = require("../stdlib/iomanager");

async function processSingle(sessionStr, event) {
  if (!event) {
    throw new Error("QUERY_EVENT_EMPTY");
  }

  if (!sessionStr) {
    throw new Error("QUERY_SESSION_EMPTY");
  }

  const session = await IOManager.getSession(sessionStr);
  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const output = await AI.processInput({
    params: { event: event },
    session
  });
  return output;
}

const run = () => {
  Server.routerListeners.post("/io_event", async (req, res) => {
    let output = null;

    try {
      if (typeof req.body === "object" && req.body.length > 1) {
        output = [];
        for (const obj of req.body) {
          const _output = await processSingle(obj.session, obj.event);
          output.push({ session: obj.session, result: _output });
        }
      } else {
        output = await processSingle(req.body.session, req.body.event);
      }

      res.json({ status: output });
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  });
};

module.exports = { run };
