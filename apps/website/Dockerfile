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
