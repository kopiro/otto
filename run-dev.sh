#!/bin/sh
GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/keys/gcloud.json \
AWS_KEY_PATH=$(pwd)/keys/aws.json \
nodemon --harmony --inspect=0.0.0.0:9229 --config nodemon.json ./src/main.js