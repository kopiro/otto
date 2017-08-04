#!/bin/bash

eval `ssh-agent -s`
chmod 400 ./keys/rsa.key
ssh-add ./keys/rsa.key
ssh -o StrictHostKeyChecking=no -f otto@kopiro.it -L 27017:localhost:27017 -N