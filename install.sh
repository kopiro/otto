#!/bin/bash

npm install

if [ "$(uname)" == "Darwin" ]; then

	brew install sox
	# say already come with OS X

elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then

	sudo apt-get -y install sox
	sudo apt-get -y install espeak

else

	echo "Platform not supported"
	exit

fi