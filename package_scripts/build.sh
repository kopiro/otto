mkdir build-web/scripts

browserify web/scripts/main.js -o build-web/scripts/main.js -t [ babelify ]