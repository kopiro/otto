#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

BLUE_ID="00:00:00:00:01:07"
BLUEZ_CARD=$(sed 's|:|_|g' <<< $BLUE_ID)

PID=""
TUNNELED=0

echo "Starting PulseAudio..."
pulseaudio --k
pulseaudio --start
sleep 2

echo "Powering on bluetooth..."
echo -e "power on" | bluetoothctl
sleep 1
echo -e "trust $BLUE_ID" | bluetoothctl
sleep 1

while true; do

	while [[ "$(pacmd list-sinks | grep bluez_card.$BLUEZ_CARD)" == "" ]]; do
		echo "Connecting to bluetooth speaker..."
		echo -e "connect $BLUE_ID" | bluetoothctl
		sleep 8
	done

	# Set sink in pulseaudio
	pacmd set-default-sink "bluez_sink.$BLUEZ_CARD"

	# If internet is reachable
	if ping -c 1 google.com >> /dev/null 2>&1; then

		# Connect to the server
		if [ "$TUNNELED" == "0" ]; then
			echo "Tunneling SSH..."
			./tunnel.sh
			TUNNELED=1
		fi

		# Check if PID is still running
		if [ ! -e /proc/$PID || -z $PID ]; then

			# Pull latest edits
			git fetch --all && git reset --hard origin/master

			# Start real app
			npm run start &
			PID=$!
		
			echo "Launched Node with pid $PID"

			# Play startup sound
			play "$DIR/audio/startup.wav" vol 0.4
		
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
