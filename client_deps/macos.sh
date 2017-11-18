#!/bin/sh

brew install nodejs
brew install sox opus-tools 

npm -g install nan && npm -g install snowboy && npm link snowboy
npm install
