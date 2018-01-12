#!/bin/bash
set -x
scp -r keys root@kopiro.it:/home/otto
scp -r keys root@otto-home.local:/root
scp -r keys root@otto.local:/root