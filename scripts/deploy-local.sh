#!/usr/bin/env bash
set -euo pipefail

if [ -t 1 ]; then
  C_RESET=$'\033[0m'
  C_BLUE=$'\033[34m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
else
  C_RESET=""; C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""
fi

info() { printf "%s[deploy-local]%s %s\n" "$C_BLUE"   "$C_RESET" "$*"; }
ok()   { printf "%s[deploy-local]%s %s\n" "$C_GREEN"  "$C_RESET" "$*"; }
warn() { printf "%s[deploy-local]%s %s\n" "$C_YELLOW" "$C_RESET" "$*" >&2; }
err()  { printf "%s[deploy-local]%s %s\n" "$C_RED"    "$C_RESET" "$*" >&2; }

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-local.sh [flags]

Brings the easyshell stack up locally via Docker Compose. By default:
  1. Stops anything currently running (preserves data).
  2. Starts Postgres and waits for it to be healthy.
  3. Runs Drizzle migrations to completion.
  4. Starts website, mustang, submission-manager, and cron.

Flags:
  --down       Stop the stack and exit (preserves Postgres volume).
  --clean      Stop the stack AND wipe the Postgres volume. Asks for
               confirmation unless --yes is also passed.
  --no-build   Skip --build on migrate and app `up` commands.
  --yes        Auto-confirm destructive operations (use with --clean).
  --help       Show this help.
EOF
}

MODE="up"
NO_BUILD=0
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --down)     MODE="down";  shift ;;
    --clean)    MODE="clean"; shift ;;
    --no-build) NO_BUILD=1;   shift ;;
    --yes|-y)   ASSUME_YES=1; shift ;;
    --help|-h)  usage; exit 0 ;;
    *)          err "unknown flag: $1"; usage; exit 1 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  err "docker is not installed or not on PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  err "Docker is not running. Start Docker and re-run."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  err "Neither 'docker compose' (v2) nor 'docker-compose' (v1) is available."
  exit 1
fi

if ! command -v infisical >/dev/null 2>&1; then
  err "infisical CLI is not installed or not on PATH."
  err "Install it (https://infisical.com/docs/cli/overview) and run 'infisical login'."
  exit 1
fi

INFISICAL_ENV="${INFISICAL_ENV:-dev}"
info "loading secrets via infisical (env=$INFISICAL_ENV)"

# Wrap every subsequent compose invocation so all phases share the same
# secret context (down, up postgres, run migrate, up app services).
COMPOSE=(infisical run --env="$INFISICAL_ENV" -- "${COMPOSE[@]}")

if REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi
cd "$REPO_ROOT"

ensure_network() {
  if ! docker network inspect easyshell >/dev/null 2>&1; then
    info "creating external docker network 'easyshell'"
    docker network create easyshell >/dev/null
  fi
}

case "$MODE" in
  down)
    info "stopping stack (preserving volumes)"
    "${COMPOSE[@]}" down --remove-orphans
    ok "stopped."
    exit 0
    ;;
  clean)
    if [ "$ASSUME_YES" -ne 1 ]; then
      warn "This will DELETE the Postgres volume (easyshell-pgdata) and all DB data."
      printf "Type 'yes' to continue: "
      read -r confirm
      if [ "$confirm" != "yes" ]; then
        err "aborted."
        exit 1
      fi
    fi
    info "stopping stack and wiping volumes"
    "${COMPOSE[@]}" down -v --remove-orphans
    ok "cleaned."
    exit 0
    ;;
esac

BUILD_FLAG=(--build)
if [ "$NO_BUILD" -eq 1 ]; then
  BUILD_FLAG=()
fi

ensure_network

info "stopping anything currently running (preserving volumes)"
"${COMPOSE[@]}" down --remove-orphans

info "starting postgres"
"${COMPOSE[@]}" up -d postgres

info "waiting for postgres to become healthy (timeout 60s)"
status="starting"
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' easyshell-dev-postgres 2>/dev/null || printf 'starting')"
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 1
done

if [ "$status" != "healthy" ]; then
  err "postgres did not become healthy (last status: $status)"
  "${COMPOSE[@]}" logs postgres || true
  exit 1
fi
ok "postgres is healthy."

info "running database migrations"
"${COMPOSE[@]}" run --rm "${BUILD_FLAG[@]}" migrate
ok "migrations applied."

info "starting application services"
"${COMPOSE[@]}" up -d "${BUILD_FLAG[@]}" website mustang submission-manager cron

info "current container status:"
"${COMPOSE[@]}" ps

ok "stack is up."
printf "\n"
printf "  Website:  http://localhost:3000\n"
printf "  Mustang:  http://localhost:4000\n"
printf "  Postgres: localhost:5432  (user/db/pw: easyshell)\n"
printf "\n"
printf "Tail logs:  %s logs -f\n" "${COMPOSE[*]}"
printf "Stop:       bash scripts/deploy-local.sh --down\n"
