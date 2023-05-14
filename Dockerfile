FROM node:18-alpine
WORKDIR /app
VOLUME /app/cache /app/log /app/keys /app/tmp
EXPOSE 80
ENTRYPOINT [ "pnpm", "run", "start" ]

# Instal base packages
RUN apk add --no-cache ca-certificates && \
    update-ca-certificates && \
    apk add --no-cache \
    openssl \
    curl \
    git \
    build-base \
    libc6-compat \
    openssh-client \
    python3

# Install additional app packages
# opus-tools: Used to decode Telegram Audio notes
RUN apk add --no-cache \
    sox \
    opus-tools 

# Install imagemagick
RUN apk add --no-cache imagemagick graphicsmagick

# Install pnpm
RUN npm install -g pnpm

# Install node modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json .eslintrc jest.config.js .prettierrc ./
RUN pnpm install

# Copy my code
COPY ./src ./src
COPY ./public ./public
COPY ./src-client ./src-client
COPY ./etc ./etc

# Install workspaces packages
RUN pnpm install

# Build code
RUN pnpm run build