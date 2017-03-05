#!/bin/bash

if [ "$(uname)" == "Darwin" ]; then

	play "$1" pitch -q 800

elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then

	play "$1" pitch -q 800

fi