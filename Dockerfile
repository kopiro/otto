FROM node:8-alpine
WORKDIR /app

RUN set -ex && apk update && apk add --no-cache \
curl \
git \
sox \
# libsox-fmt-mp3 \
# dadadodo \
#libav-tools \
ffmpeg

COPY package.json /package.json
RUN cd / && npm install --unsafe-perm

COPY . /app
RUN ln -svf /node_modules /app/node_modules

RUN npm run build

CMD /app/docker/prod.sh
EXPOSE 8880 8881 8882