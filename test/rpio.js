var rpio = require('rpio');
rpio.open(16, rpio.INPUT, rpio.PULL_UP);
 
function pollcb(pin)
{
	var state = rpio.read(pin) ? 'pressed' : 'released';
	console.log('Button event on P%d (button currently %s)', pin, state);
}
 
rpio.poll(16, pollcb);