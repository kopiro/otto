#!/bin/bash

set -ex

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

wget -O - https://raw.githubusercontent.com/audstanley/NodeJs-Raspberry-Pi/master/Install-Node.sh | bash

apt-get -y install libmagic-dev libatlas-base-dev
npm -g install nan --unsafe-perm
npm -g install snowboy --unsafe-perm && npm link snowboy
npm -g install rpio --unsafe-perm && npm link rpio
npm -g install apa102-spi --unsafe-perm && npm link apa102-spi
npm -g install miio --unsafe-perm && npm link miio

npm install --only=prod --unsafe-perm