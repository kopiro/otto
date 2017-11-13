#!/bin/bash

DIR="/root/otto-ai"

PID=""
TUNNELED="no"

while true; do

	# If internet is reachable
	if ping -c 1 google.com >> /dev/null 2>&1; then

		# Connect to the server
		if [ "$TUNNELED" == "no" ]; then
			echo "Tunneling SSH..."
			$DIR/tunnel.sh
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

			echo "Restarted Node with pid $PID"

		fi

	else

		echo "No Internet connection detected."
		aplay "$DIR/audio/nointernet.wav"

	fi

	sleep 1

done
