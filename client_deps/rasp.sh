#!/bin/bash

# Install base libraries
apt-get -y install sox
apt-get -y install libsox-fmt-all
apt-get -y install opus-tools
apt-get -y install mopidy

apt-get -y install supervisor
mkdir -p /var/log/otto
echo "[program:otto]
directory=/root/otto-ai
command=npm run start
autostart=true
autorestrart=true
stdout_logfile=/var/log/otto/out.log
stderr_logfile=/var/log/otto/err.log
" >/etc/supervisor/conf.d/otto.conf

# Install nodeJS
wget -O - https://raw.githubusercontent.com/audstanley/NodeJs-Raspberry-Pi/master/Install-Node.sh | bash

# Install Snowboy
apt-get -y install libmagic-dev libatlas-base-dev
npm -g install nan --unsafe-perm
npm -g install snowboy --unsafe-perm && npm link snowboy
npm -g install rpio --unsafe-perm && npm link rpio
npm -g install apa102-spi --unsafe-perm && npm link apa102-spi

# Install deps
npm install --only=prod