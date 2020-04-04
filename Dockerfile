FROM node:12-alpine
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
COPY package.json yarn.lock tsconfig.json .eslintrc jest.config.js .prettierrc ./
RUN yarn install

# Copy my code
COPY ./src ./src
COPY ./etc ./etc

# Install workspaces packages
RUN yarn install

RUN ls -la

# Build code
RUN yarn build:code

# Clean src
RUN rm -rf ./src

ENTRYPOINT [ "yarn", "start:built" ]
VOLUME /app/cache /app/log /app/keys /app/tmp /app/tmp-secret
EXPOSE 80
