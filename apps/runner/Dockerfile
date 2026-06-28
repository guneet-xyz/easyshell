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

FROM node:22-alpine AS runtime
RUN apk add --no-cache docker
WORKDIR /app

# Runtime needs node_modules because esbuild externalizes better-sqlite3 (native addon),
# pino, pino-pretty, and thread-stream (worker-thread + dynamic require quirks).
COPY --from=build /src/apps/runner/runner.cjs runner.cjs
COPY --from=build /src/apps/runner/node_modules ./node_modules

EXPOSE 4200
ENTRYPOINT ["node", "runner.cjs"]
