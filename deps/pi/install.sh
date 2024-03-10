#!/bin/bash

sudo apt-get -y install \
    sox \
    libsox-fmt-all \
    opus-tools \
    gpac

runuser -l otto -c 'mkdir -p ~/.config/systemd/user; cd /home/otto/ai; cp ./deps/pi/otto.service ~/.config/systemd/user/otto.service'

runuser -l otto -c 'cd /home/otto/ai && pnpm install'
