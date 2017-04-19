var Mopidy = require("mopidy");
var mopidy = new Mopidy({
	webSocketUrl: "ws://localhost:6680/mopidy/ws/"
});

let ready = false;

mopidy.on("state:online", () => {
	ready = true;
});

mopidy.onReady = function(cb) {
	if (ready) {
		cb();
	} else {
		mopidy.on("state:online", cb);
	}
};

module.exports = mopidy;