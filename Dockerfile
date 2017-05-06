FROM node

RUN mkdir -p /app
WORKDIR /app

COPY . /app
RUN yarn

EXPOSE 8880 443
CMD [ "npm", "start" ]