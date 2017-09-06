FROM ubuntu

RUN apt-get -y update

RUN apt-get -y install \
curl \
git

RUN curl -sL https://deb.nodesource.com/setup_6.x | bash - && \
apt-get -y install nodejs && \
npm install -g yarn

RUN apt-get -y install \
sox \
libsox-fmt-mp3 \
dadadodo \
libav-tools \
ffmpeg

WORKDIR /app
EXPOSE 8880 8881 8882

COPY package.json /app/package.json
RUN yarn

COPY . /app

RUN npm run build

CMD /app/docker/prod.sh