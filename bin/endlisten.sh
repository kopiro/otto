#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ "$(uname)" == "Darwin" ]; then
	play "$DIR/../audio/endlisten.wav"
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
	aplay "$DIR/../audio/endlisten.wav"
fi