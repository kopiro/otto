#!/bin/bash

wget https://github.com/grpc/grpc/files/1484635/grpc_node.node.zip
unzip grpc_node.node.zip
mv grpc_node.node /usr/local/lib/grpc_node.node 
rm grpc_node.node.zip

mkdir -p /opt/nodejs/lib/node_modules/apa102-spi/node_modules/rpio/build
ln -svf /opt/nodejs/lib/node_modules/rpio/build/Release/rpio.node /opt/nodejs/lib/node_modules/apa102-spi/node_modules/rpio/build/rpio.node

mkdir -p ./node_modules/google-gax/node_modules/grpc/src/node/extension_binary/node-v57-linux-arm
ln -svf /usr/local/lib/grpc_node.node ./node_modules/google-gax/node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/grpc_node.node

mkdir -p ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/
ln -svf /usr/local/lib/grpc_node.node ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/grpc_node.node

mkdir -p ./node_modules/@google-cloud/speech/node_modules/grpc/src/node/extension_binary/node-v57-linux-arm-glibc
ln -svf /usr/local/lib/grpc_node.node ./node_modules/@google-cloud/speech/node_modules/grpc/src/node/extension_binary/node-v57-linux-arm-glibc/grpc_node.node