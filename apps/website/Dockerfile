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

WORKDIR /src/apps/website

ARG NEXT_PUBLIC_POSTHOG_KEY
ARG POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV POSTHOG_HOST=$POSTHOG_HOST
ENV PROJECT_ROOT=/src
RUN pnpm run cache
RUN pnpm run build

FROM node:22-alpine
RUN apk add --no-cache curl

WORKDIR /app

COPY --from=build /src/apps/website/.next/standalone ./
COPY --from=build /src/apps/website/.next/static ./apps/website/.next/static
COPY --from=build /src/apps/website/public ./apps/website/public

WORKDIR /app/apps/website

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["node", "server.js"]
