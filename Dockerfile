FROM node:8-alpine
WORKDIR /app

# Instal base packages
RUN set -ex && \
	apk update && \
	apk add ca-certificates && \
	update-ca-certificates && \
	apk add --no-cache \
	openssl \
	curl \
	git \
	build-base \
	libc6-compat \
	openssh-client

# Install additional app packages
RUN apk add --no-cache \
	sox \
	opus-tools # Used to decode Telegram Audio notes

# Install imagemagick
RUN apk add --no-cache imagemagick graphicsmagick

# Cleanup
RUN rm -rf /var/cache/apk/*

# Install node modules
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN yarn install

COPY web-client/package.json web-client/package.json
COPY web-client/package-lock.json web-client/package-lock.json
RUN cd web-client && yarn install

# Copy my code
COPY . .

# Do the build of client
RUN cd web-client && npm run build

ENTRYPOINT /app/entrypoint.sh
EXPOSE 80
