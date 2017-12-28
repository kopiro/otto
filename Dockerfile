FROM node:8-alpine
WORKDIR /app

# Instal base packages
RUN set -ex && \
apk update && \
apk add ca-certificates && \
update-ca-certificates && \
apk add --no-cache \
openssl \
curl \
git \
build-base \
libc6-compat \
openssh-client

# Install additional app packages
RUN apk add --no-cache \
sox \
opus-tools # Used to decode Telegram Audio notes

# Install dadadodo from source
RUN cd /tmp && \
wget https://www.jwz.org/dadadodo/dadadodo-1.04.tar.gz && \
tar -xvf dadadodo-1.04.tar.gz && \
cd dadadodo-1.04 && \
make && \
mv dadadodo /usr/local/bin && \
cd .. && \
rm -rf dadadodo-1.04 && \
rm dadadodo-1.04.tar.gz

# Cleanup
RUN rm -rf /var/cache/apk/*

# Install node modules
ENV NODE_ENV development
COPY package.json /package.json
COPY package-lock.json /package-lock.json
RUN cd / && npm install --unsafe-perm && rm -rf ~/.npm

# Copy my code
COPY . /app
RUN ln -svf /node_modules /app/node_modules

# Do the build
RUN npm run build

CMD /app/docker/prod.sh
EXPOSE 80