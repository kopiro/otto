#!/bin/bash

apt-get update

apt-get -y install sox
apt-get -y install libsox-fmt-all
apt-get -y install opus-tools
apt-get -y install libmagic-dev libatlas-base-dev

wget -q -O - https://apt.mopidy.com/mopidy.gpg | sudo apt-key add -
wget -q -O /etc/apt/sources.list.d/mopidy.list https://apt.mopidy.com/jessie.list
apt-get update
apt-get -y install mopidy mopidy-spotify mpc

apt-get -y install libavahi-compat-libdnssd-dev

if which node > /dev/null
then
	echo "Node has already been installed"
else
	wget -O - https://raw.githubusercontent.com/audstanley/NodeJs-Raspberry-Pi/master/Install-Node.sh | bash
fi

yarn install --production