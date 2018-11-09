#!/bin/sh
if [ "$DEV" = "1" ]; then
   npm run dev
else
   npm run start
fi