const TAG = 'Server';

let Server = apprequire('server');

///////////
// Admin //
///////////

Server.routerAdmin.get('/', (req, res) => {
	res.render('admin/home', {
		layout: 'admin'
	});
});

////////////
// Client //
////////////

Server.routerClient.get('/', (req, res) => {
	res.render('client/home', {
		layout: 'client'
	});
});

/////////
// API //
/////////

console.info(TAG, 'started');
