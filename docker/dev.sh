#!/bin/sh

ln -svf /node_modules /app/node_modules
yarn --production=false
npm run dev