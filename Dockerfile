FROM node

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . /usr/src/app
RUN yarn install

EXPOSE 8880 
EXPOSE 443

CMD [ "npm", "run", "dev" ]