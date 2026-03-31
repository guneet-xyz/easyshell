FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache bash jq

WORKDIR /src

COPY pnpm-workspace.yaml .
COPY pnpm-lock.yaml .
COPY package.json .

COPY apps/db-proxy/package.json apps/db-proxy/package.json
COPY apps/submission-manager/package.json apps/submission-manager/package.json
COPY apps/website/package.json apps/website/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/problems/package.json packages/problems/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY scripts/package.json scripts/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

WORKDIR /src/apps/submission-manager

ENV PROJECT_ROOT=/src
RUN pnpm run cache
RUN pnpm exec esbuild index.ts --bundle --platform=node --outfile=submission-manager.cjs

FROM node:22-alpine
RUN apk add --no-cache docker

WORKDIR /app

COPY --from=build /src/apps/submission-manager/submission-manager.cjs submission-manager.cjs

ENTRYPOINT ["node", "submission-manager.cjs"]
