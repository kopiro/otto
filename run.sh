#!/bin/sh
GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/keys/gcloud.json \
AWS_KEY_PATH=$(pwd)/keys/aws.json \
node --harmony ./src/main.js