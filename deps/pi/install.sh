#!/bin/bash

# git clone https://github.com/kopiro/otto.git ai
# git pull
# ./deps/pi/install.sh

# Chck if we running as "root"
if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

NODE_MAJOR=22
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt-get -y install \
    sox \
    libsox-fmt-all \
    opus-tools \
    gpac \
    nodejs

runuser -l otto -c 'cd ~/ai; mkdir -p ~/.config/systemd/user; cp ./deps/pi/otto.service ~/.config/systemd/user/otto.service; systemctl --user daemon-reload'

runuser -l otto -c 'cd ~/ai && pnpm install'
