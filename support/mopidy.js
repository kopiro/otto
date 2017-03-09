var Mopidy = require("mopidy");
var mopidy = new Mopidy({
    webSocketUrl: "ws://localhost:6680/mopidy/ws/"
});

mopidy.on("state:online", () => {
	mopidy.ready = true;
});

mopidy.onReady = function(cb) {
	if (mopidy.ready) cb();
	else {
		mopidy.on("state:online", cb);
	}
};

// mopidy.on(console.log.bind(console));

module.exports = mopidy;