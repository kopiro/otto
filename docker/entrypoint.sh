#!/bin/sh

export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/keys/gcloud.json

if [ "$DEV" = "1" ]; then
   npm i
   npm run dev
else
   npm run start
fi