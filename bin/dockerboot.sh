#!/bin/bash

cd /app

eval `ssh-agent -s`

ssh-add /keys/ssh

echo "IdentityFile /keys/ssh" >> /etc/ssh/ssh_config &&
echo -e "StrictHostKeyChecking no" >> /etc/ssh/ssh_config

if [ ! -d ./.git ]; then

	echo "==> Cloning repo...."
	git clone git@github.com:kopiro/otto-ai.git .
	yarn install 

fi

ln -svf /config.json ./config.json
rm -rf ./keys
ln -svf /keys ./keys

echo "==> Starting app...."
npm run dev