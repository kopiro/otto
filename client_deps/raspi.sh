#!/bin/sh

# Install nodeJS
wget -O - https://raw.githubusercontent.com/sdesalas/node-pi-zero/master/install-node-v7.7.1.sh | bash
ln -svf /opt/nodejs/yarn /usr/bin/yarn

apt-get -y install sox libsox-fmt-mp3 opus-tools 

# Install deps
npm install --only=prod