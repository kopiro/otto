FROM node

COPY ./bin/dockerboot.sh /bin/dockerboot
COPY ./keys /keys

VOLUME /app

COPY ./config.json /config.json

EXPOSE 8880 443

WORKDIR /app
CMD /bin/dockerboot