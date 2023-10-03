ARG NODE_VERSION=18
ARG NPM_VERSION=9.8.1

FROM node:${NODE_VERSION}-alpine

RUN npm install -g npm@${NPM_VERSION}

WORKDIR /opt/app

ENTRYPOINT [ ".docker/entrypoints/local.sh" ]
