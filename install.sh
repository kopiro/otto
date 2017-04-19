#!/bin/bash

if [ "$(uname)" == "Darwin" ]; then

	brew install sox

	brew tap mopidy/mopidy
	brew install mopidy
	brew install mopidy-spotify

	brew install libav

elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then

	sudo apt-get -y install sox
	
	sudo apt-get -y install mopidy
	sudo apt-get -y install mopidy-spotify

	sudo apt-get -y install libsox-fmt-mp3

	sudo apt-get -y install libav

else

	echo "Platform not supported"
	exit

fi

yarn install
