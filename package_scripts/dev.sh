#!/bin/bash

trap 'kill $(jobs -p)' EXIT

mkdir -p build-web/scripts

watchify web/scripts/main.jsx -o build-web/scripts/main.js -t [ babelify ] &
watchify web/scripts/memories.jsx -o build-web/scripts/memories.js -t [ babelify ] &
watchify web/scripts/cron.jsx -o build-web/scripts/cron.js -t [ babelify ] &

wait