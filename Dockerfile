FROM node:22-alpine
WORKDIR /app
VOLUME /app/cache /app/logs /app/keys /app/tmp

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
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json .eslintrc .prettierrc ./
RUN pnpm install

# Install cron
RUN echo "0 3 * * * cd /app && pnpm run ai:social 2>&1 > /app/logs/ai_social_cron.log" >> /var/spool/cron/crontabs/root
RUN echo "5 3 * * * cd /app && pnpm run ai:sleep 2>&1 > /app/logs/ai_sleep_cron.log" >> /var/spool/cron/crontabs/root

# Copy my code
COPY ./src ./src
COPY ./public ./public
COPY ./src-client ./src-client
COPY ./etc ./etc

# Install workspaces packages
RUN pnpm install

# Build code
RUN pnpm run build
RUN pnpm recursive run build

EXPOSE 80
CMD crond -L /app/logs/cron.log && pnpm run start

ENV NODE_ENV=production