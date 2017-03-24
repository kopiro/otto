#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

start_node=1
BLUE_ID="FC:58:FA:35:48:95"
BLUEZ_CARD="FC_58_FA_35_48_95"

echo "Starting SSH tunnel..."
/usr/bin/sshtunneldb

echo "Starting PulseAudio..."
pulseaudio --start

while true; do

	echo "Powering on bluetooth..."
	echo -e "power on" | bluetoothctl

	while [[ "$(pacmd list-sinks | grep bluez_card.$BLUEZ_CARD)" == "" ]]; do
		echo "Connecting to bluetooth speaker..."
		echo -e "connect $BLUE_ID" | bluetoothctl
		sleep 5
	done
	pacmd set-default-sink "bluez_sink.$BLUEZ_CARD"

	if ping -c 1 google.com >> /dev/null 2>&1; then

		if [ $start_node -ge 1 ]; then
			play "$DIR/audio/startup.wav" vol 0.4

			echo "Auto updating..."
			git fetch --all
			git reset --hard origin/master
			yarn

			echo "Stopping older instances..."
			forever stop otto

			echo "Starting Node instance..."
			forever start forever.json

			start_node=0
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
