FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache bash jq

WORKDIR /src

COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store CI=true pnpm install --frozen-lockfile

WORKDIR /src/apps/coordinator

RUN pnpm exec esbuild src/index.ts --bundle --platform=node --outfile=coordinator.cjs --external:pino --external:pino-pretty --external:thread-stream --external:better-sqlite3

FROM node:22-alpine
WORKDIR /app

# pino + thread-stream spawn worker threads and resolve files via __dirname, which
# breaks when bundled by esbuild (worker entry resolves to /app/lib/worker.js, missing).
# pino-pretty is the pretty transport @easyshell/logger uses when NODE_ENV != production.
# Keep all three unbundled and install them here. Versions match pnpm-lock.yaml.
RUN npm install --omit=dev --no-package-lock pino@^9.14.0 pino-pretty@^11.3.0

COPY --from=build /src/apps/coordinator/coordinator.cjs coordinator.cjs

EXPOSE 4100
ENTRYPOINT ["node", "coordinator.cjs"]
