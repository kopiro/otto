#!/bin/bash

# curl "http://localhost:9000/io/rest?sessionId=test" -X POST --data "text=Ciao"

# curl "http://localhost:9000/io/rest?sessionId=test" -X POST -F "audio=@hello.m4a"

curl "http://localhost:9000/io/rest?sessionId=test&outputType=voice" -X POST --data "text=Ciao"