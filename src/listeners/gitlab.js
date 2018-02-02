const TAG = 'gitlab';

const Server = apprequire('server');

exports.listen = function() {
	Server.routerListeners.post('/gitlab', async(req, res) => {
		const listeners = await Data.Listener.find({ listener: TAG });
		listeners.forEach((l) => {
			IOManager.input({
				session: l.session,
				params: {
					event: {
						name: TAG,
						data: {
							body: new Buffer(JSON.stringify(req.body)).toString('base64')
						}
					}
				}
			});
		});
		
		res.json({
			listeners: listeners
		});
	});
};