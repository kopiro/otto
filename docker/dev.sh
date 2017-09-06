#!/bin/sh

yarn --production=false
/app/tunnel.sh
npm run dev