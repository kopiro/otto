#!/bin/sh

brew install node
brew install lame
brew install sox --with-lame
brew install opus-tools 

npm -g install nan && npm -g install snowboy && npm link snowboy
npm install
