#!/bin/sh
# Builds testcases/<id>/backup.zip from the files in fixtures/<id>/.
#
# The archives are reproducible (fixed entry order, mode and mtime, no extra
# fields). Entries are stored in reverse order, so that listing them isn't
# already sorted. Testcase 3 also gets an empty directory, and testcase 4 has
# no directory entries at all (zip -D). It needs Info-ZIP zip; to use the same
# version as the committed archives, run it in Alpine:
#
#   docker run --rm -v "$PWD":/p -w /p alpine:3.21 \
#     sh -c 'apk add --no-cache zip >/dev/null && ./generate.sh'
set -eu

cd "$(dirname "$0")"
out=$(pwd)
export TZ=UTC

for dir in fixtures/*/; do
  id=$(basename "$dir")
  stage=$(mktemp -d)
  cp -R "$dir." "$stage"
  if [ "$id" = 3 ]; then
    mkdir "$stage/old backups"
  fi
  find "$stage" -type d -exec chmod 755 {} +
  find "$stage" -type f -exec chmod 644 {} +
  find "$stage" -exec touch -d "2026-11-13 03:00:00" {} +

  rm -f "$out/testcases/$id/backup.zip"
  if [ "$id" = 4 ]; then
    (cd "$stage" && find . -type f | cut -c3- | sort -r |
      zip -X -D -q "$out/testcases/$id/backup.zip" -@)
  else
    (cd "$stage" && find . -mindepth 1 | cut -c3- | sort -r |
      zip -X -q "$out/testcases/$id/backup.zip" -@)
  fi
  rm -rf "$stage"
  echo "testcases/$id/backup.zip"
done
