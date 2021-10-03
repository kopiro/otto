#!/bin/sh
node ./build > /home/otto/log 2>&1
tail -f /home/otto/log