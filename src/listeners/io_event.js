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
    params: { event },
    session
  });
  return output;
}

exports.start = () => {
  Server.routerListeners.post("/io_event", async (req, res) => {
    const list =
      typeof req.body === "object" && req.body.length > 1
        ? req.body
        : [req.body];
    const output = [];

    try {
      for (const obj of list) {
        const _output = await processSingle(obj.session, obj.event);
        output.push({ session: obj.session, result: _output });
      }

      return res.json({ status: output });
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  });
};
