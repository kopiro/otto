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

wget -O - https://raw.githubusercontent.com/audstanley/NodeJs-Raspberry-Pi/master/Install-Node.sh | bash

npm -g install nan --unsafe-perm
npm -g install snowboy --unsafe-perm
npm -g install rpio --unsafe-perm
npm -g install apa102-spi --unsafe-perm
npm -g install miio --unsafe-perm

npm install --only=prod --unsafe-perm

npm link snowboy
npm link rpio
npm link apa102-spi
npm link miio