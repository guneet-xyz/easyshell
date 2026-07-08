FROM node:22-alpine

WORKDIR /src

RUN cat > package.json <<'EOF'
{"type":"module","dependencies":{"drizzle-kit":"0.31.9","drizzle-orm":"0.45.2","postgres":"3.4.8"},"devDependencies":{}}
EOF
RUN --mount=type=cache,id=npm,target=/root/.npm npm install --omit=dev --no-package-lock

COPY drizzle drizzle
COPY drizzle.config.ts drizzle.config.ts
COPY packages/db/schema.ts packages/db/schema.ts

ENTRYPOINT ["./node_modules/.bin/drizzle-kit", "migrate"]
