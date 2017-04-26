#!/bin/bash

{
	if [ uname | grep "Darwin" ]; then

		echo "==> Platform: Darwin"

		brew install sox

		brew tap mopidy/mopidy
		brew install mopidy
		brew install mopidy-spotify

		brew install ffmpeg
		brew install libav

	elif [ uname | grep "Linux" ]; then

		echo "==> Platform: Linux"

		if [ cat /etc/os-release | grep "Raspbian" ]; then

			echo "==> Subplatform: Raspbian"

			wget -O - https://raw.githubusercontent.com/sdesalas/node-pi-zero/master/install-node-v7.7.1.sh | bash
			ln -svf /opt/nodejs/yarn /usr/bin/yarn

			apt-get install -y gpac

		else

			echo "==> Subplatform: Generic Linux"

			apt-get install nodejs

		fi

		npm -g install yarn

		apt-get -y install libsox-fmt-mp3
		
		apt-get -y install sox
		
		apt-get -y install mopidy
		apt-get -y install mopidy-spotify

		apt-get -y install ffmpeg
		apt-get -y install libav-tools

	else

		echo "==> Platform not supported"
		exit

	fi

	echo "==> Launching Yarn..."
	yarn
}