#!/bin/sh

rm -rf node_modules
ln -s /node_modules /app/node_modules
npm install --only=dev
npm run dev