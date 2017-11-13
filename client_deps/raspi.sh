#!/bin/sh

# Install nodeJS
wget -O - https://raw.githubusercontent.com/sdesalas/node-pi-zero/master/install-node-v7.7.1.sh | bash

# Install base libraries
apt-get -y install sox libsox-fmt-mp3 opus-tools 

# Insall node dependencies globally
npm -g install rpio && npm link rpio

# Install deps
npm install --only=prod

# Install the compiled grpc
mkdir -p ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/
ln -svf /root/grpc_node.node ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/grpc_node.node