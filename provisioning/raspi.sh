#!/bin/sh

# Install nodeJS
wget -O - https://raw.githubusercontent.com/sdesalas/node-pi-zero/master/install-node-v7.7.1.sh | bash
ln -svf /opt/nodejs/yarn /usr/bin/yarn

# FFMPEG
apt-get install -y gpac && \
wget https://github.com/ccrisan/motioneye/wiki/precompiled/ffmpeg_3.1.1-1_armhf.deb && \
dpkg -i ffmpeg_3.1.1-1_armhf.deb && \
rm ffmpeg_3.1.1-1_armhf.deb

# Other libraries
apt-get -y install \
sox \
libsox-fmt-mp3 \
dadadodo \
libav-tools