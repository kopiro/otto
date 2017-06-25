#!/bin/bash

{
	if [ $(uname | grep "Darwin") ]; then

		echo "==> Platform: Darwin"

		brew install sox

		brew tap mopidy/mopidy
		brew install mopidy
		brew install mopidy-spotify

		brew install ffmpeg
		brew install libav
		
		brew install homebrew/science/dadadodo

	elif [ $(uname | grep "Linux") ]; then

		echo "==> Platform: Linux"

		if [ $(cat /etc/os-release | grep "Raspbian") ]; then

			echo "==> Subplatform: Raspbian"

			wget -O - https://raw.githubusercontent.com/sdesalas/node-pi-zero/master/install-node-v7.7.1.sh | bash
			ln -svf /opt/nodejs/yarn /usr/bin/yarn

			apt-get install -y gpac

			wget https://github.com/ccrisan/motioneye/wiki/precompiled/ffmpeg_3.1.1-1_armhf.deb && 
			dpkg -i ffmpeg_3.1.1-1_armhf.deb &&
			rm ffmpeg_3.1.1-1_armhf.deb

		else

			echo "==> Subplatform: Generic Linux"

			apt-get install nodejs

			apt-get -y install ffmpeg

		fi

		apt-get -y install libsox-fmt-mp3
		
		apt-get -y install sox
		
		apt-get -y install mopidy
		apt-get -y install mopidy-spotify

		apt-get -y install libav-tools

		apt-get -y install dadadodo

		npm -g install yarn

	else

		echo "==> Platform not supported"
		exit

	fi

	echo "==> Launching Yarn..."
	yarn
}