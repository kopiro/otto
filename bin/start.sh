#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ "$(uname)" == "Darwin" ]; then
	"$DIR/../out-speech.sh" "Buongiorno, sono pronto!"
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
	"$DIR/../out-speech.sh" "Buongiorno, sono pronto!"
fi