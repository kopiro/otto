#!/bin/bash

sudo apt update

sudo apt -y install sox
sudo apt -y install libsox-fmt-all
sudo apt -y install opus-tools
sudo apt -y install libmagic-dev libatlas-base-dev

sudo apt -y install libavahi-compat-libdnssd-dev

sudo apt -y install raspistill raspivid gpac

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.2/install.sh | bash
source ~/.bash_profile
nvm install 12
nvm use 12

npm -g install yarn

yarn install --production