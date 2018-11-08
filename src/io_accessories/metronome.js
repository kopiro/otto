exports.id = 'metronome';

const Metronome = apprequire('metronome');

exports.canHandleOutput = function(e, session) {
	if (e.payload.metronome) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
};

exports.output = async function(e, session) {
	if (e.payload.metronome.stop) {
		Metronome.stop();
	} else {
		Metronome.start(e.payload.metronome.bpm);
	}
};

exports.attach = function(io) {};
