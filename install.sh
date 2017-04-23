#!/bin/bash

{
	if [ "$(uname)" == "Darwin" ]; then

		brew install sox

		brew tap mopidy/mopidy
		brew install mopidy
		brew install mopidy-spotify

		brew install libav

	elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then

		wget -O - https://raw.githubusercontent.com/sdesalas/node-pi-zero/master/install-node-v7.7.1.sh | bash
		npm -g install yarn
		ln -svf /opt/nodejs/yarn /usr/bin/yarn

		apt-get -y install libsox-fmt-mp3
		
		apt-get -y install sox
		
		apt-get -y install mopidy
		apt-get -y install mopidy-spotify

		apt-get -y install libav-tools

	else

		echo "Platform not supported"
		exit

	fi

	yarn
}