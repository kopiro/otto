FROM node:8-alpine
WORKDIR /app

RUN set -ex && \
apk update && \
apk add ca-certificates && \
update-ca-certificates && \
apk add --no-cache \
openssl \
curl \
git \
libc6-compat \
# dadadodo \
openssh-client

RUN apk add --no-cache \
sox \
opus-tools # Used to decode Telegram Audio notes

RUN rm -rf /var/cache/apk/*

COPY package.json /package.json
RUN cd / && npm install --unsafe-perm

COPY . /app
RUN ln -svf /node_modules /app/node_modules

RUN npm run build

CMD /app/docker/prod.sh
EXPOSE 8880 8881 8882