import * as Server from "../stdlib/server";
import * as AI from "../stdlib/ai";
import * as IOManager from "../stdlib/iomanager";
import { InputParams } from "../types";

class IOEvent implements IOManager.IOListenerModule {
  async processSingle(sessionStr: string, event: InputParams["event"]) {
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

    return AI.processInput({ event }, session);
  }

  start() {
    Server.routerListeners.post("/io_event", async (req, res) => {
      const list = typeof req.body === "object" && req.body.length > 1 ? req.body : [req.body];
      const output = [];

      try {
        for (const obj of list) {
          const _output = await this.processSingle(obj.session, obj.event as InputParams["event"]);
          output.push({ session: obj.session, result: _output });
        }

        return res.json({ status: output });
      } catch (err) {
        console.error("IO Event", err);
        return res.status(400).json({
          error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
        });
      }
    });
  }
}

export default new IOEvent();
