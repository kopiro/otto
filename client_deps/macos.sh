#!/bin/sh

brew install lame
brew install sox
brew install opus-tools

nvm install 8
nvm use 8

npm -g install yarn

yarn install