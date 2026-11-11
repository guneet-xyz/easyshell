#!/usr/bin/env bash
# Checks that an image pushed by digest is a single-platform image for the
# expected architecture with SBOM and provenance attestations.
#
# Usage: scripts/verify-image-attestations.sh <repository> <digest> <amd64|arm64>
set -euo pipefail

repository=${1:?usage: $0 <repository> <digest> <arch>}
digest=${2:?usage: $0 <repository> <digest> <arch>}
arch=${3:?usage: $0 <repository> <digest> <arch>}

if [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "Invalid image digest: $digest" >&2
  exit 1
fi

index=$(docker buildx imagetools inspect --raw "$repository@$digest")
image=$(jq --exit-status --raw-output --arg arch "$arch" '
  [.manifests[] | select(.platform.os == "linux")] as $images
  | if ($images | length) == 1 and $images[0].platform.architecture == $arch
    then $images[0].digest else error("expected exactly one linux/\($arch) image") end
' <<<"$index")
attestation=$(jq --exit-status --raw-output --arg image "$image" '
  [.manifests[] | select(.annotations["vnd.docker.reference.type"] == "attestation-manifest"
    and .annotations["vnd.docker.reference.digest"] == $image) | .digest]
  | if length == 1 then .[0] else error("expected one attestation manifest") end
' <<<"$index")
docker buildx imagetools inspect --raw "$repository@$attestation" |
  jq --exit-status '
    [.layers[].annotations["in-toto.io/predicate-type"] // empty] as $types
    | ($types | any(startswith("https://slsa.dev/provenance/")))
      and ($types | any(. == "https://spdx.dev/Document"))
  ' >/dev/null || {
  echo "$repository@$digest lacks SBOM or provenance attestations" >&2
  exit 1
}

echo "Verified $repository@$digest: linux/$arch image $image with SBOM and provenance"
