FROM node:26-alpine AS node

FROM node AS node-curl
RUN apk add --no-cache curl

FROM node AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN npm i -g corepack
RUN corepack enable

WORKDIR /src

COPY apps/submission-manager/package.json apps/submission-manager/package.json
COPY apps/website/package.json apps/website/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/data/package.json packages/data/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY scripts/package.json scripts/package.json

COPY package.json package.json
COPY pnpm-lock.yaml pnpm-lock.yaml
COPY pnpm-workspace.yaml pnpm-workspace.yaml

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN apk add --no-cache bash jq

FROM build-deps AS build
COPY . .

FROM build AS build-submission-manager
WORKDIR /src/apps/submission-manager
ENV PROJECT_ROOT=/src
RUN pnpm run build

FROM node AS submission-manager
COPY --from=build-submission-manager /src/apps/submission-manager/submission-manager.cjs /app/submission-manager.cjs
ENTRYPOINT ["node", "/app/submission-manager.cjs"]

FROM build AS build-website
WORKDIR /src/apps/website

ARG POSTHOG_KEY
ARG POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_KEY=$POSTHOG_KEY
ENV POSTHOG_HOST=$POSTHOG_HOST
ENV PROJECT_ROOT=/src
RUN pnpm run build

FROM node-curl AS website

WORKDIR /app

COPY --from=build-website /src/apps/website/.next/standalone ./
COPY --from=build-website /src/apps/website/.next/static ./apps/website/.next/static
COPY --from=build-website /src/apps/website/public ./apps/website/public

WORKDIR /app/apps/website

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

ENV APP="website"
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["node", "server.js"]

FROM alpine:3.21 AS go
RUN apk add --no-cache go

FROM go AS build-session-manager
WORKDIR /src

COPY apps/session-manager /src

RUN go build

FROM alpine:3.21 AS session-manager

RUN apk add --no-cache docker
EXPOSE 4000

COPY --from=build-session-manager /src/session-manager /session-manager

ENTRYPOINT ["/session-manager"]
