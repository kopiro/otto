#!/bin/bash

npm install

if [ "$(uname)" == "Darwin" ]; then

	brew install sox

	brew tap mopidy/mopidy
	brew install mopidy
	brew install mopidy-spotify
	brew install mcp

elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then

	sudo apt-get -y install sox
	
	sudo apt-get -y install mopidy
	sudo apt-get -y install mopidy-spotify
	sudo apt-get -y install mcp

else

	echo "Platform not supported"
	exit

fi