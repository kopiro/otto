import * as Server from "../stdlib/server";
import * as IOManager from "../stdlib/iomanager";
import ai from "../stdlib/ai";

class IOEvent implements IOManager.IOListenerModule {
  start() {
    Server.routerListeners.post("/io_event", async (req, res) => {
      try {
        const obj = req.body;
        const session = await IOManager.getSession(obj.session);
        const output = await ai().processInput({ event: obj.event }, session);
        return res.json({ status: output });
      } catch (err) {
        console.error("IO Event", err);
        return res.status(400).json({
          error: err,
        });
      }
    });
  }
}

let _instance: IOEvent;
export default (): IOEvent => {
  _instance = _instance || new IOEvent();
  return _instance;
};
