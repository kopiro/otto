#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

BLUE_ID="FC:58:FA:35:48:95"
BLUEZ_CARD="FC_58_FA_35_48_95"

echo "Starting PulseAudio..."
pulseaudio --k
pulseaudio --start

while true; do

	# echo "Powering on bluetooth..."
	# echo -e "power on" | bluetoothctl
	# echo -e "trust $BLUE_ID" | bluetoothctl
	# echo -e "pair $BLUE_ID" | bluetoothctl

	while [[ "$(pacmd list-sinks | grep bluez_card.$BLUEZ_CARD)" == "" ]]; do
		echo "Connecting to bluetooth speaker..."
		echo -e "connect $BLUE_ID" | bluetoothctl
		sleep 5
	done
	pacmd set-default-sink "bluez_sink.$BLUEZ_CARD"

	if ping -c 1 google.com >> /dev/null 2>&1; then

		echo "Starting SSH tunnel..."
		./tunnel.sh

		# Check if PID is still running
		if [ -z $PID || ! kill $PID > /dev/null 2>&1 ]; then
		
			npm run start &
			PID=$!
		
			echo "Launched Node with pid $PID"

			play "$DIR/audio/startup.wav" vol 0.4
		
		fi

	else

		echo "No Internet connection detected."
		aplay "$DIR/audio/nointernet.wav"

	fi
	
	# If speaker is gone, this loop exists
	# This is also a method to retrigger startup
	while [[ "$(pacmd list-sinks | grep bluez_card.$BLUEZ_CARD)" != "" ]]; do
		sleep 10
	done

done
