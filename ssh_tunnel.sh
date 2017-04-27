#!/bin/bash

# Create a tunnel to forward MySQL remote port 3306 to local port to 3307
ssh -f otto@kopiro.it -L 3307:localhost:3306 -N