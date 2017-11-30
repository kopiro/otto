#!/bin/sh

brew install node
brew install lame
brew install sox --with-lame
brew install opus-tools 
brew install mopidy

npm -g install nan && npm -g install snowboy && npm link snowboy
npm -g install miio && npm link miio
npm install
