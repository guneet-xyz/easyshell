FROM node:22-alpine AS build
RUN apk add --no-cache bash jq

WORKDIR /src

COPY apps/db-proxy/package.json apps/db-proxy/package.json
COPY apps/submission-manager/package.json apps/submission-manager/package.json
COPY apps/website/package.json apps/website/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/problems/package.json packages/problems/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY scripts/package.json scripts/package.json

COPY package.json package.json
COPY package-lock.json package-lock.json

RUN npm ci

COPY . .

WORKDIR /src/apps/submission-manager

ENV PROJECT_ROOT=/src
RUN npm run cache
RUN npx esbuild index.ts --bundle --platform=node --outfile=submission-manager.cjs

FROM node:22-alpine
RUN apk add --no-cache docker

WORKDIR /app

COPY --from=build /src/apps/submission-manager/submission-manager.cjs submission-manager.cjs

ENV APP="submission-manager"
ENTRYPOINT ["node", "submission-manager.cjs"]
