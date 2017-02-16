module.exports = function sayHello(request) {
	console.info('AI.sayHello', request);
	return new Promise(function(resolve, reject) {
		resolve({
			user: request.entities.contact[0].value
		});
	});
};