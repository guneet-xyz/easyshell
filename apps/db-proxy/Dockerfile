FROM node:22-alpine AS build

WORKDIR /root

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY apps/db-proxy/package.json ./apps/db-proxy/package.json
COPY apps/submission-manager/package.json ./apps/submission-manager/package.json
COPY apps/website/package.json ./apps/website/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/env/package.json ./packages/env/package.json
COPY packages/problems/package.json ./packages/problems/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY scripts/package.json ./scripts/package.json

RUN npm ci

COPY . .

WORKDIR /root/apps/db-proxy

ENV PROJECT_ROOT=/root
RUN npm run build

FROM node:22-alpine

COPY --from=build /root/apps/db-proxy/db-proxy.cjs /root/db-proxy.cjs

ENV APP=db-proxy
ENTRYPOINT ["node", "/root/db-proxy.cjs"]
