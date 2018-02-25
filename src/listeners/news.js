const TAG = 'news';

const Server = apprequire('server');

exports.listen = function() {
	Server.routerListeners.post('/news', async(req, res) => {
		const listeners = await Data.Listener.find({ listener: TAG });
		
		listeners.forEach((l) => {
			IOManager.input({
				session: l.session,
				params: {
					event: {
						name: TAG,
						data: IOManager.encodeBody(req.body)
					}
				}
			});
		});
		
		res.json({
			listeners: listeners
		});
	});
};