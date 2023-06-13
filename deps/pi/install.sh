#!/bin/bash

sudo apt-get -y install \
    sox \
    libsox-fmt-all \
    opus-tools \
    gpac

su -c otto "pnpm install --production"