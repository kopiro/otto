FROM node:8-alpine
WORKDIR /app

RUN set -ex && apk update && apk add --no-cache \
sox \
libsox-fmt-mp3 \
dadadodo \
libav-tools \
ffmpeg

COPY package.json /node_modules/package.json
RUN cd /node_modules && yarn

COPY . /app

RUN ln -svf /node_modules /app/node_modules

RUN npm run build

EXPOSE 8880 8881 8882

CMD /app/docker/prod.sh