#!/bin/sh

# Install NodeJS
brew install nodejs
npm -g install yarn

# FFMPEG
brew install ffmpeg --with-libvorbis --with-libvpx

# SOX
brew install sox

# Install deps
yarn