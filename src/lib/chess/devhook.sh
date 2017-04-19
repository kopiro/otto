#!/bin/bash
echo "Chess: Hook started"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
watchify "$DIR/src/index.js" -o "$DIR/public/index.min.js" -t [ babelify ] &