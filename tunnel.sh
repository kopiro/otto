#!/bin/bash

eval `ssh-agent -s`
chmod 400 ./keys/rsa.key
ssh-add ./keys/rsa.key
ssh -o StrictHostKeyChecking=no -f otto@kopiro.it -L 27018:localhost:27018 -N