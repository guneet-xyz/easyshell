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

info() { printf "%s[problems-build]%s %s\n" "$C_BLUE"   "$C_RESET" "$*"; }
ok()   { printf "%s[problems-build]%s %s\n" "$C_GREEN"  "$C_RESET" "$*"; }
warn() { printf "%s[problems-build]%s %s\n" "$C_YELLOW" "$C_RESET" "$*" >&2; }
err()  { printf "%s[problems-build]%s %s\n" "$C_RED"    "$C_RESET" "$*" >&2; }

usage() {
  cat <<'EOF'
Usage: bash scripts/problems-build.sh [flags]

Builds all problem Docker images locally:
  1. Generates fresh build contexts under $WORKING_DIR/build-output/.
  2. Syncs (rsync -ac --delete) into $WORKING_DIR/build-cache/, preserving
     mtimes on unchanged files so Docker's layer cache stays valid.
  3. Runs `docker build` for every image in build-cache/ (parallel).

Docker's own layer cache makes a no-op full run take ~5s.

Flags:
  --force    Wipe $WORKING_DIR/build-cache/ before syncing (forces full
             rebuild; docker layer cache may still help).
  --jobs N   Override PARALLEL_LIMIT (default: 8).
  --help     Show this help.

Environment:
  WORKING_DIR     Default $XDG_CACHE_HOME/easyshell (typically ~/.cache/easyshell).
  PARALLEL_LIMIT  Default 8 (was 5 in build.ts).
EOF
}

FORCE=0
JOBS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --force)   FORCE=1; shift ;;
    --jobs)
      if [ $# -lt 2 ]; then err "--jobs requires an argument"; exit 1; fi
      JOBS="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *)         err "unknown flag: $1"; usage; exit 1 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  err "docker is not installed or not on PATH."
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  err "rsync is not installed or not on PATH."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  err "git is not installed or not on PATH."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  err "Docker is not running. Start Docker and re-run."
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

WORKING_DIR="${WORKING_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/easyshell}"
export WORKING_DIR
if [ -n "$JOBS" ]; then
  export PARALLEL_LIMIT="$JOBS"
else
  export PARALLEL_LIMIT="${PARALLEL_LIMIT:-8}"
fi
export DOCKER_BUILDKIT=1

mkdir -p "$WORKING_DIR/build-cache"
if [ "$FORCE" = 1 ]; then
  info "wiping $WORKING_DIR/build-cache/ (--force)"
  rm -rf "$WORKING_DIR/build-cache"/* 2>/dev/null || true
fi

info "generating build contexts"
pnpm --silent --filter @easyshell/problems run generate-contexts all

info "syncing contexts into build-cache (checksum mode)"
rsync -ac --delete \
  "$WORKING_DIR/build-output/" \
  "$WORKING_DIR/build-cache/"

info "building docker images from build-cache"
pnpm --silent --filter @easyshell/problems run build

ok "done."
