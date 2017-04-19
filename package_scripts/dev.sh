#!/bin/bash

trap 'kill $(jobs -p)' EXIT

mkdir -p public/scripts

echo "Compiling base Javascript files..."
watchify web/scripts/main.jsx -o public/scripts/main.min.js -t [ babelify ] &
watchify web/scripts/memories.jsx -o public/scripts/memories.min.js -t [ babelify ] &
watchify web/scripts/cron.jsx -o public/scripts/cron.min.js -t [ babelify ] &

find . -name "devhook.sh" -exec ./{} \; &

wait