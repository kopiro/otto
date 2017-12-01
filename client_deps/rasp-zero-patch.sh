#!/bin/bash

GRPC_COMPILED="/root/grpc_node.node"

mkdir -p /opt/nodejs/lib/node_modules/apa102-spi/node_modules/rpio/build
ln -svf /opt/nodejs/lib/node_modules/rpio/build/Release/rpio.node /opt/nodejs/lib/node_modules/apa102-spi/node_modules/rpio/build/rpio.node

mkdir -p ./node_modules/google-gax/node_modules/grpc/src/node/extension_binary/node-v57-linux-arm
ln -svf $GRPC_COMPILED ./node_modules/google-gax/node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/grpc_node.node

mkdir -p ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/
ln -svf $GRPC_COMPILED ./node_modules/grpc/src/node/extension_binary/node-v57-linux-arm/grpc_node.node