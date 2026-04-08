FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /src

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile

WORKDIR /src/apps/mustang

RUN pnpm --filter @easyshell/problems run cache:mustang
RUN pnpm exec esbuild index.ts --bundle --platform=node --outfile=mustang.cjs

FROM node:22-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY --from=build /src/apps/mustang/mustang.cjs mustang.cjs

EXPOSE 4000

ENTRYPOINT ["node", "mustang.cjs"]
