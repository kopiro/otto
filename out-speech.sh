#!/bin/sh

if [ "$(uname)" == "Darwin" ]; then

	say "$1" -v Federica -o /tmp/ottoai.aiff && 
	play /tmp/ottoai.aiff pitch -q 600 speed 1

elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then

	espeak -v it "$1" -a 200 -w /tmp/ottoai.wav &&
	play /tmp/ottoai.wav pitch -q 600 speed 1

fi