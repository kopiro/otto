#!/bin/bash

sudo apt-get -y install \
    sox \
    libsox-fmt-all \
    opus-tools \
    gpac

runuser -l otto -c 'cd /home/otto/ai && pnpm install --production'