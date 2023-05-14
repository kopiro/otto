#!/bin/bash

sudo apt-get -y install \
    sox \
    libsox-fmt-all \
    opus-tools \
    raspistill \
    raspivid \
    gpac

pnpm install --production