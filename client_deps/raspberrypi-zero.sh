#!/bin/sh

# Install nodeJS
wget -O - https://raw.githubusercontent.com/sdesalas/node-pi-zero/master/install-node-v7.7.1.sh | bash

# Install base libraries
apt-get -y install sox libsox-fmt-mp3 opus-tools 

# Install deps
npm install --only=prod

# Install RPIO
npm -g install rpio --unsafe-perm && npm link rpio

# Install apa102-spi and link with global RPIO
npm -g install apa102-spi --unsafe-perm && npm link apa102-spi
mkdir -p /opt/nodejs/lib/node_modules/apa102-spi/node_modules/rpio/build
ln -svf /opt/nodejs/lib/node_modules/rpio/build/Release/rpio.node /opt/nodejs/lib/node_modules/apa102-spi/node_modules/rpio/build/rpio.node

# Install the compiled GRPC
mkdir -p ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/
ln -svf /root/grpc_node.node ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/grpc_node.node