#!/bin/bash

sudo apt-get update

sudo apt-get -y install sox
sudo apt-get -y install libsox-fmt-all
sudo apt-get -y install opus-tools
sudo apt-get -y install libmagic-dev libatlas-base-dev

sudo apt-get -y install libavahi-compat-libdnssd-dev

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.2/install.sh | bash
source ~/.bash_profile
nvm install 8

npm -g install yarn

yarn install --production