#!/bin/bash

# Install nodeJS
wget -O - https://raw.githubusercontent.com/sdesalas/node-pi-zero/master/install-node-v7.7.1.sh | bash

# Install base libraries
apt-get -y install sox libsox-fmt-all opus-tools supervisor

mkdir -p /var/log/otto
echo "[program:otto]
command = node /root/otto-ai/main.js
autostart = true
autorestrart = true
stderr_logfile = /var/log/otto/out.log
stdout_logfile = /var/log/otto/err.log
" >/etc/supervisor/conf.d/otto.conf

# Install Snowboy
apt-get -y install libmagic-dev libatlas-base-dev
npm -g install nan --unsafe-perm

# Install deps
npm install --only=prod

# Install RPIO
npm -g install rpio --unsafe-perm && npm link rpio

# Install apa102-spi and link with global RPIO
npm -g install apa102-spi --unsafe-perm && npm link apa102-spi
mkdir -p /opt/nodejs/lib/node_modules/apa102-spi/node_modules/rpio/build
ln -svf /opt/nodejs/lib/node_modules/rpio/build/Release/rpio.node /opt/nodejs/lib/node_modules/apa102-spi/node_modules/rpio/build/rpio.node

# Install the compiled GRPC
mkdir -p ./node_modules/google-gax/node_modules/grpc/src/node/extension_binary/node-v57-linux-arm
ln -svf /root/grpc_node.node ./node_modules/google-gax/node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/grpc_node.node

mkdir -p ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/
ln -svf /root/grpc_node.node ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/grpc_node.node