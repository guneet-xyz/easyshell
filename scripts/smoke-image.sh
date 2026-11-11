#!/usr/bin/env bash
# Starts an application image and checks that it boots and answers, against a
# throwaway PostgreSQL where it needs one. CI runs it on local builds; releases
# run it on the exact pushed digest before any of its tags are published.
#
# Usage: scripts/smoke-image.sh <coordinator|runner|website|migrator> <image>
#
# Needs Docker and curl, and a checkout of this repository (the coordinator and
# website checks migrate the database with a migrator built from it).
set -euo pipefail

app=${1:?usage: $0 <coordinator|runner|website|migrator> <image>}
image=${2:?usage: $0 <coordinator|runner|website|migrator> <image>}
root=$(cd "$(dirname "$0")/.." && pwd)

id="easyshell-smoke-$$"
network=$id
db="$id-db"
container="$id-$app"
migrator="$id-migrator"
database_url="postgres://easyshell:smoke-test-password@$db:5432/easyshell"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ] && docker container inspect "$container" >/dev/null 2>&1; then
    echo "--- $app logs ---"
    docker logs "$container" 2>&1 | tail -n 100 || true
  fi
  docker rm --force "$container" "$db" >/dev/null 2>&1 || true
  docker image rm "$migrator" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

docker network create "$network" >/dev/null

start_database() {
  docker run --detach --name "$db" --network "$network" \
    --env POSTGRES_USER=easyshell \
    --env POSTGRES_PASSWORD=smoke-test-password \
    --env POSTGRES_DB=easyshell \
    postgres:18-alpine >/dev/null
  # Over TCP, so the temporary server of the image's first-run setup, which
  # only listens on a socket, doesn't count as ready.
  for _ in $(seq 60); do
    if docker exec "$db" pg_isready --host 127.0.0.1 --username easyshell --dbname easyshell >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "PostgreSQL did not become ready" >&2
  return 1
}

# Runs migrations with the given migrator image.
migrate() {
  docker run --rm --network "$network" --env DATABASE_URL="$database_url" "$1"
}

migrate_from_checkout() {
  docker buildx build --quiet --load --file "$root/apps/migrator/Dockerfile" --tag "$migrator" "$root" >/dev/null
  migrate "$migrator"
}

assert_migrated() {
  result=$(docker exec "$db" psql --username easyshell --dbname easyshell --tuples-only --no-align \
    --command "select to_regclass('public.easyshell_runner') is not null")
  if [ "$result" != t ]; then
    echo "Migrations did not create the expected tables" >&2
    return 1
  fi
}

# Waits until a URL on the app container's published port answers with a body
# containing the expected text.
expect_http() {
  port=$1 path=$2 expected=$3
  address=$(docker port "$container" "$port/tcp" | head -n 1)
  for _ in $(seq 60); do
    if body=$(curl --fail --silent --show-error --max-time 5 "http://$address$path" 2>/dev/null) &&
      grep --quiet --fixed-strings "$expected" <<<"$body"; then
      echo "$app answered $path"
      return 0
    fi
    if [ "$(docker container inspect --format '{{.State.Running}}' "$container")" != true ]; then
      echo "$app exited" >&2
      return 1
    fi
    sleep 2
  done
  echo "$app did not answer $path with $expected" >&2
  return 1
}

case "$app" in
migrator)
  start_database
  migrate "$image"
  assert_migrated
  # Applying migrations again must be a no-op.
  migrate "$image"
  ;;
coordinator)
  start_database
  migrate_from_checkout
  docker run --detach --name "$container" --network "$network" --publish 127.0.0.1::4100 \
    --env DATABASE_URL="$database_url" \
    --env WEBSITE_TOKEN=smoke-test-token \
    --env COORDINATOR_SECRET_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
    --env NODE_ENV=production \
    "$image" >/dev/null
  expect_http 4100 '/health.ping?input=%7B%7D' '"ok":true'
  ;;
runner)
  # The coordinator is unreachable: the runner keeps retrying its heartbeat
  # but must still boot and serve.
  docker run --detach --name "$container" --publish 127.0.0.1::4200 \
    --env RUNNER_ID=smoke-test-runner \
    --env RUNNER_TOKEN=smoke-test-token \
    --env RUNNER_NAME=smoke-test \
    --env RUNNER_PUBLIC_URL=http://localhost:4200 \
    --env COORDINATOR_URL=http://127.0.0.1:9 \
    --env NODE_ENV=production \
    "$image" >/dev/null
  expect_http 4200 '/health.ping?input=%7B%7D' '"ok":true'
  # The runner drives user containers with the Docker CLI.
  docker run --rm --entrypoint docker "$image" --version
  ;;
website)
  start_database
  migrate_from_checkout
  docker run --detach --name "$container" --network "$network" --publish 127.0.0.1::3000 \
    --env DATABASE_URL="$database_url" \
    --env BETTER_AUTH_SECRET=smoke-test-secret-of-at-least-32-characters \
    --env BETTER_AUTH_URL=http://localhost:3000 \
    --env COORDINATOR_URL=http://127.0.0.1:9 \
    --env WEBSITE_TOKEN=smoke-test-token \
    --env ADMIN_EMAILS=admin@example.com \
    --env NODE_ENV=production \
    "$image" >/dev/null
  expect_http 3000 / 'Using the terminal should be'
  expect_http 3000 /api/auth/ok '"ok":true'
  ;;
*)
  echo "Unknown app: $app" >&2
  exit 2
  ;;
esac

echo "Smoke test passed: $app ($image)"
