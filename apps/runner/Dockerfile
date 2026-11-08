FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache bash jq python3 make g++

WORKDIR /src

COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store CI=true pnpm install --frozen-lockfile

WORKDIR /src/apps/runner

RUN pnpm exec esbuild src/index.ts --bundle --platform=node --outfile=runner.cjs \
    --external:better-sqlite3 \
    --external:pino \
    --external:pino-pretty \
    --external:thread-stream

# esbuild externalizes better-sqlite3 (native addon), pino, pino-pretty and
# thread-stream (worker-thread + dynamic require quirks). Install them as real
# directories: pnpm's node_modules under apps/runner are symlinks into the
# workspace store, which do not survive a COPY into the runtime image.
# Versions match pnpm-lock.yaml.
FROM node:22-alpine AS runtime-deps
RUN apk add --no-cache python3 make g++
WORKDIR /deps
RUN npm install --omit=dev --no-package-lock better-sqlite3@11.10.0 pino@9.14.0 pino-pretty@11.3.0

FROM node:22-alpine AS runtime
RUN apk add --no-cache docker-cli
WORKDIR /app

COPY --from=runtime-deps /deps/node_modules ./node_modules
COPY --from=build /src/apps/runner/runner.cjs runner.cjs

EXPOSE 4200
ENTRYPOINT ["node", "runner.cjs"]
