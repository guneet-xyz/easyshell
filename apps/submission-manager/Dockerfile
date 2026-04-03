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

WORKDIR /src/apps/submission-manager

ENV PROJECT_ROOT=/src
RUN pnpm run cache
RUN pnpm exec esbuild index.ts --bundle --platform=node --outfile=submission-manager.cjs

FROM node:22-alpine
RUN apk add --no-cache docker

WORKDIR /app

COPY --from=build /src/apps/submission-manager/submission-manager.cjs submission-manager.cjs

ENTRYPOINT ["node", "submission-manager.cjs"]
