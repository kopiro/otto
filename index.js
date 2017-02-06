var AI = require('./ai');
var IO = require('./io');

var myAI = new AI();

function conversate() {
	IO.input()
	.then(myAI.startConversation.bind(myAI))
	.then(IO.output)
	.catch(function(err) {
		console.error('CONVERSATION_ERROR', err);
	})
	.then(function() {
		setTimeout(conversate, 1000);
	});
}

myAI.init().then(
	conversate
);