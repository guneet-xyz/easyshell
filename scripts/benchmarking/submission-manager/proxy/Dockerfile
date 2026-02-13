FROM node:22-alpine AS build

WORKDIR /src

COPY . .

RUN npm ci

WORKDIR /src/scripts/benchmarking/submission-manager/proxy

ENV PROJECT_ROOT=/src
RUN npx esbuild benchmarking/submission-manager/proxy/index.ts --bundle --platform=node --outfile=proxy.cjs

FROM node:22-alpine

RUN apk add --no-cache docker

COPY --from=build /src/scripts/proxy.cjs /app/proxy.cjs

ENTRYPOINT ["node", "/app/proxy.cjs"]
