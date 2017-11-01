FROM ubuntu
WORKDIR /app

RUN set -ex && apt-get -y update && apt-get -y install \
curl \
git \
sox \
libsox-fmt-mp3 \
dadadodo \
libav-tools \
ffmpeg && \
curl -sL https://deb.nodesource.com/setup_6.x | bash - && \
apt-get -y install nodejs && \
npm install -g yarn

COPY package.json /node_modules/package.json
RUN yarn

COPY . /app
RUN ln -s /node_modules /app/node_modules

RUN npm run build

CMD /app/docker/prod.sh
EXPOSE 8880 8881 8882