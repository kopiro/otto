FROM node

RUN mkdir -p /app
WORKDIR /app

COPY . /app
RUN yarn

RUN apt-get -y install libsox-fmt-mp3
		
RUN apt-get -y install sox
		
RUN apt-get -y install mopidy
RUN apt-get -y install mopidy-spotify

RUN apt-get -y install libav-tools

RUN apt-get -y install dadadodo

EXPOSE 8880 443
CMD [ "npm", "start" ]