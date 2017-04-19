#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
browserify "$DIR/src/index.js" -o "$DIR/public/index.min.js" -t [ babelify ]