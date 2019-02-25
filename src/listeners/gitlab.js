const TAG = 'gitlab';

const Server = requireLibrary('server');

exports.listen = function () {
  Server.routerListeners.post('/gitlab', async (req, res) => {
    const listeners = await Data.Listener.find({ listener: TAG });

    listeners.forEach((l) => {
      // TODO
      // IOManager.handle({
      // 	session: l.session,
      // 	params: {
      // 		event: {
      // 			name: TAG,
      // 			data: IOManager.encodeBody(req.body)
      // 		}
      // 	}
      // });
    });

    res.json({
      listeners,
    });
  });
};
