#!/bin/sh
# Builds testcases/<id>/present.tar.gz from the files in fixtures/<id>/.
#
# The archives are reproducible (sorted entries, fixed owner, mode and mtime,
# no gzip name or timestamp). It needs GNU tar and gzip; to use the same
# versions as the committed archives, run it in Alpine:
#
#   docker run --rm -v "$PWD":/p -w /p alpine:3.21 \
#     sh -c 'apk add --no-cache tar gzip >/dev/null && ./generate.sh'
set -eu

cd "$(dirname "$0")"

for dir in fixtures/*/; do
  id=$(basename "$dir")
  stage=$(mktemp -d)
  cp -R "$dir." "$stage"
  find "$stage" -type d -exec chmod 755 {} +
  find "$stage" -type f -exec chmod 644 {} +
  # shellcheck disable=SC2046 # fixture names contain no spaces
  tar --create --file=- --directory="$stage" --sort=name --format=gnu \
    --owner=0 --group=0 --numeric-owner --mtime=@1735689600 \
    $(ls -A "$stage") | gzip -9 -n >"testcases/$id/present.tar.gz"
  rm -rf "$stage"
  echo "testcases/$id/present.tar.gz"
done
