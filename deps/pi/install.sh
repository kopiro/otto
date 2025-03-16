#!/bin/bash

# git clone https://github.com/kopiro/otto.git ai
# ./deps/pi/install.sh

# Chck if we running as "root"
if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# Install dependencies if node not found
if ! command -v node &> /dev/null
then
  NODE_MAJOR=22
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
  echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
  apt update
  apt-get -y install \
    sox \
    libsox-fmt-all \
    opus-tools \
    nodejs
  corepack enable
fi

runuser -l otto -c 'cd ~/ai && pnpm install'

cp ./deps/pi/otto.service /etc/systemd/system/otto.service
systemctl daemon-reload