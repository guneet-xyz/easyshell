FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache bash jq

WORKDIR /src

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile

WORKDIR /src/apps/cron

ENV PROJECT_ROOT=/src
RUN pnpm run cache
RUN pnpm exec esbuild index.ts --bundle --platform=node --outfile=cron.cjs

FROM node:22-alpine

WORKDIR /app

COPY --from=build /src/apps/cron/cron.cjs cron.cjs

ENTRYPOINT ["node", "cron.cjs"]
