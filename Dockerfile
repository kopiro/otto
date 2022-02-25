FROM node:16-alpine
WORKDIR /app
VOLUME /app/cache /app/log /app/keys /app/tmp
EXPOSE 80
ENTRYPOINT [ "yarn", "start" ]

# Instal base packages
RUN apk add --no-cache ca-certificates && \
    update-ca-certificates && \
    apk add --no-cache \
    openssl \
    curl \
    git \
    build-base \
    libc6-compat \
    openssh-client

# Install additional app packages
# opus-tools: Used to decode Telegram Audio notes
RUN apk add --no-cache \
    sox \
    opus-tools 

# Install imagemagick
RUN apk add --no-cache imagemagick graphicsmagick


# Install node modules
COPY package.json yarn.lock tsconfig.json .eslintrc jest.config.js .prettierrc ./
RUN yarn install

# Copy my code
COPY ./src ./src
COPY ./public ./public
COPY ./src-client ./src-client
COPY ./etc ./etc

# Install workspaces packages
RUN yarn install

# Build code
RUN yarn build