FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache bash jq

WORKDIR /src

COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store CI=true pnpm install --frozen-lockfile

WORKDIR /src/apps/coordinator

RUN pnpm exec esbuild src/index.ts --bundle --platform=node --outfile=coordinator.cjs --external:pino-pretty --external:better-sqlite3

FROM node:22-alpine
WORKDIR /app

COPY --from=build /src/apps/coordinator/coordinator.cjs coordinator.cjs

EXPOSE 4100
ENTRYPOINT ["node", "coordinator.cjs"]
