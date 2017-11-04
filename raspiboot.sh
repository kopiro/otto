#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

BLUEZ_CARD=$(sed 's|:|_|g' <<< $BLUE_ID)
PID=""
TUNNELED="no"

echo "Starting PulseAudio..."
pulseaudio --start

while true; do

	while [[ "$(pacmd list-sinks | grep bluez_card.$BLUEZ_CARD)" == "" ]]; do
		echo -e "connect $BLUE_ID" | bluetoothctl
		sleep 2
	done

	# If internet is reachable
	if ping -c 1 google.com >> /dev/null 2>&1; then

		# Connect to the server
		if [ "$TUNNELED" == "no" ]; then
			echo "Tunneling SSH..."
			./tunnel.sh
			TUNNELED="yes"
		fi

		# Check if PID is still running
		if [ -z $PID ]; then

			# Pull latest edits
			git fetch --all && git reset --hard origin/master

			# Start real app
			npm run start &
			PID=$!
		
			echo "Launched Node with pid $PID"

			# Play startup sound
			play "$DIR/audio/startup.wav" vol 0.4

		elif [ ! -e /proc/$PID ]; then

			# Restart real app
			npm run start &
			PID=$!

		fi

	else

		echo "No Internet connection detected."
		aplay "$DIR/audio/nointernet.wav"

	fi
	
	# If speaker is gone, this loop exits, so this is a method to retrigger startup
	while [[ "$(pacmd list-sinks | grep bluez_card.$BLUEZ_CARD)" != "" ]]; do
		sleep 10
	done

done
