#!/bin/sh

echo "==> Replacing node modules"
rm -rf node_modules
ln -s /node_modules /app/node_modules

echo "==> Tunneling"
/app/tunnel.sh

echo "==> Running supervisor"
npm run dev