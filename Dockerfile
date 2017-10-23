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

COPY package.json /node_modules/package.json
RUN cd /node_modules && yarn

COPY . /app

RUN ln -svf /node_modules /app/node_modules

RUN npm run build

CMD /app/docker/prod.sh