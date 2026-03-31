FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /src

COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

WORKDIR /src/scripts/benchmarking/submission-manager/proxy

ENV PROJECT_ROOT=/src
RUN pnpm exec esbuild benchmarking/submission-manager/proxy/index.ts --bundle --platform=node --outfile=proxy.cjs

FROM node:22-alpine

RUN apk add --no-cache docker

COPY --from=build /src/scripts/proxy.cjs /app/proxy.cjs

ENTRYPOINT ["node", "/app/proxy.cjs"]
