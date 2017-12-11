#!/bin/sh

echo "==> Replacing node modules"
rm -rf node_modules
ln -s /node_modules /app/node_modules

echo "==> Updating package-lock.json"
ln -svf /package-lock.json /app/package-lock.json

echo "==> Running supervisor"
npm run dev