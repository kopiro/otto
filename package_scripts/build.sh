#!/bin/bash

mkdir -p public/scripts

browserify web/scripts/main.jsx -o public/scripts/main.min.js -t [ babelify ]
browserify web/scripts/memories.jsx -o public/scripts/memories.min.js -t [ babelify ]
browserify web/scripts/cron.jsx -o public/scripts/cron.min.js -t [ babelify ]

find . -name "buildhook.sh" -exec ./{} \;