ARG APP
ARG NODE_VERSION=18
ARG NPM_VERSION=9.8.1

FROM node:${NODE_VERSION}-slim AS base
RUN npm install -g npm@${NPM_VERSION}

FROM base AS build
ARG APP
WORKDIR /opt/app/src/
ADD package.json package-lock.json ./
RUN npm ci
ADD nest-cli.json tsconfig.build.json tsconfig.json ./ 
ADD libs ./libs 
ADD apps ./apps
RUN npm run test
RUN npm run build ${APP}

FROM base AS production-packages
WORKDIR /opt/app/
ADD package.json package-lock.json ./
RUN npm ci --omit=dev

FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian11 AS app
ARG APP
WORKDIR /opt/app
COPY --from=build /opt/app/src/dist/apps/${APP} .
COPY --from=production-packages /opt/app/package-lock.json .
COPY --from=production-packages /opt/app/node_modules ./node_modules
CMD ["main.js"]

FROM app AS final
