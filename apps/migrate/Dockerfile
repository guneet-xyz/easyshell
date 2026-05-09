FROM node:22-alpine

ENV CI=true
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Stub workspace manifests so `pnpm install --frozen-lockfile` can resolve
# the lockfile without copying every package's source.
COPY apps/cron/package.json               ./apps/cron/package.json
COPY apps/mustang/package.json            ./apps/mustang/package.json
COPY apps/submission-manager/package.json ./apps/submission-manager/package.json
COPY apps/website/package.json            ./apps/website/package.json
COPY packages/db/package.json             ./packages/db/package.json
COPY packages/mustang/package.json        ./packages/mustang/package.json
COPY packages/problems/package.json       ./packages/problems/package.json
COPY packages/utils/package.json          ./packages/utils/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY drizzle.config.ts ./drizzle.config.ts
COPY drizzle           ./drizzle
COPY packages/db       ./packages/db

ENTRYPOINT ["pnpm", "exec", "drizzle-kit", "migrate"]
