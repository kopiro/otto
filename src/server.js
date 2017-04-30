const TAG = 'Server';

let Server = apprequire('server');

///////////
// Admin //
///////////

Server.routerAdmin.get('/', (req, res) => {
	res.render('admin/home');
});

/////////
// API //
/////////
