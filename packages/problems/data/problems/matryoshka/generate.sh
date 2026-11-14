#!/bin/sh
# Builds testcases/<id>/doll.tar.gz by wrapping fixtures/<id>/secret.txt in
# the layers listed below, innermost first.
#
# How a layer is made depends on its name:
# - <previous name>.gz/.bz2/.xz compresses the previous layer;
# - *.tar, *.tar.gz, *.tar.bz2 and *.tar.xz are a tar (then compressed)
#   holding the previous layer;
# - *.zip is a zip holding the previous layer.
#
# The archives are reproducible (fixed owner, mode and mtime, no gzip name or
# timestamp, single-threaded xz). It needs GNU tar, gzip, bzip2, xz and
# Info-ZIP zip; to use the same versions as the committed archives, run it in
# Alpine:
#
#   docker run --rm -v "$PWD":/p -w /p alpine:3.21 \
#     sh -c 'apk add --no-cache tar gzip bzip2 xz zip >/dev/null && ./generate.sh'
set -eu

cd "$(dirname "$0")"
export TZ=UTC

layers() {
  case "$1" in
    1) echo secret.txt.gz tiny-doll.zip doll.tar.gz ;;
    2) echo smallest.tar.xz small.tar medium.zip medium.zip.bz2 doll.tar.gz ;;
    3) echo secret.txt.bz2 onion.zip onion.zip.gz shallot.tar.xz garlic.zip \
      leek.tar leek.tar.bz2 doll.tar.gz ;;
    4) echo classified.tar classified.tar.gz top-secret.zip eyes-only.tar.xz \
      eyes-only.tar.xz.bz2 burn-after-reading.zip burn-after-reading.zip.gz \
      shred-me.tar doll.tar.gz ;;
  esac
}

tarball() {
  tar --create --file=- --format=gnu --owner=0 --group=0 --numeric-owner \
    --mtime=@1763002800 --mode=644 "$1"
}

for dir in fixtures/*/; do
  id=$(basename "$dir")
  work=$(mktemp -d)
  cp "${dir}secret.txt" "$work/secret.txt"
  prev=secret.txt
  for name in $(layers "$id"); do
    (
      cd "$work"
      touch -d "2025-11-13 03:00:00" "$prev"
      chmod 644 "$prev"
      case "$name" in
        "$prev.gz") gzip -9 -n -c "$prev" >"$name" ;;
        "$prev.bz2") bzip2 -9 -c "$prev" >"$name" ;;
        "$prev.xz") xz -T1 -6 -c "$prev" >"$name" ;;
        *.tar) tarball "$prev" >"$name" ;;
        *.tar.gz) tarball "$prev" | gzip -9 -n >"$name" ;;
        *.tar.bz2) tarball "$prev" | bzip2 -9 >"$name" ;;
        *.tar.xz) tarball "$prev" | xz -T1 -6 >"$name" ;;
        *.zip) zip -X -q "$name" "$prev" ;;
        *)
          echo "don't know how to make $name" >&2
          exit 1
          ;;
      esac
      rm "$prev"
    )
    prev=$name
  done
  mv "$work/doll.tar.gz" "testcases/$id/doll.tar.gz"
  rm -rf "$work"
  echo "testcases/$id/doll.tar.gz"
done
