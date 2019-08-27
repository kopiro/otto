const Server = require('../stdlib/server');
const AI = require('../stdlib/ai');
const IOManager = require('../stdlib/iomanager');

const run = () => {
  Server.routerListeners.post('/io_event', async (req, res) => {
    if (!req.body.event) {
      return res.status(400).json({
        error: 'QUERY_EVENT_EMPTY'
      });
    }
    if (!req.body.session) {
      return res.status(400).json({
        error: 'QUERY_SESSION_EMPTY'
      });
    }
    const session = await IOManager.getSession(req.body.session);
    if (!session) {
      return res.status(400).json({ error: 'SESSION_NOT_FOUND' });
    }
    const output = await AI.processInput({
      params: { event: req.body.event },
      session
    });
    res.json({ status: output });
  });
};

module.exports = { run };
