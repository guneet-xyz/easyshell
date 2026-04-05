# K3s base image for EasyShell live-environment problems
#
# This image provides:
# - k3s (lightweight Kubernetes)
# - The EasyShell entrypoint binary with k3s-session mode
# - kubectl, bash, and common tools
# - A cgroupv2 compatibility entrypoint script
#
# Usage:
#   docker run --privileged --cgroupns=private \
#     --tmpfs /run --tmpfs /var/run \
#     -m 1g --cpus 1.0 \
#     -v <host-dir>:/tmp/easyshell \
#     easyshell-k3s-base \
#     -mode k3s-session

# Stage 1: Build the entrypoint binary
FROM golang:1.23-alpine AS build-entrypoint
WORKDIR /src
COPY entrypoint/ /src/
RUN go build -o /bin/entrypoint

# Stage 2: Get bash + common tools from Alpine
# The rancher/k3s image is scratch-based with no package manager,
# so we copy bash and its dependencies from Alpine.
FROM alpine:3.21 AS tools
RUN apk add --no-cache bash

# Stage 3: Pre-bake container images into tarballs for k3s airgap import.
# k3s automatically imports all tarballs from /var/lib/rancher/k3s/agent/images/
# on startup (via PreloadImages()), before the kubelet starts. This eliminates
# slow/flaky image pulls from Docker Hub at runtime, which cause setup.sh
# rollout timeouts under resource-constrained containers.
# IMPORTANT: The image tag here MUST match what the manifests/ directory
# references. If you change the image here, update the manifests too.
FROM gcr.io/go-containerregistry/crane:latest AS crane-bin
FROM alpine:3.21 AS crane
COPY --from=crane-bin /ko-app/crane /usr/local/bin/crane
RUN crane pull --platform linux/amd64 docker.io/library/nginx:1.27-alpine /nginx.tar

# Stage 4: Final image based on rancher/k3s
FROM rancher/k3s:v1.32.3-k3s1

# Copy bash and its dependencies from Alpine
# (the k3s image is scratch-based with no dynamic linker or package manager)
COPY --from=tools /bin/bash /bin/bash
COPY --from=tools /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1
COPY --from=tools /usr/lib/libreadline.so* /usr/lib/
COPY --from=tools /usr/lib/libncursesw.so* /usr/lib/

# Copy our entrypoint binary
COPY --from=build-entrypoint /bin/entrypoint /entrypoint

# Pre-baked images for k3s airgap import (loaded automatically on k3s startup)
RUN mkdir -p /var/lib/rancher/k3s/agent/images
COPY --from=crane /nginx.tar /var/lib/rancher/k3s/agent/images/nginx.tar

# Pre-baked k3s manifests (auto-applied by k3s deploy controller on startup).
# Problems place their namespace/deployment YAML in a manifests/ directory,
# which is copied here. k3s applies them automatically after the API server
# starts, so setup.sh only needs to wait for rollout — not create resources.
# COPY manifests/ /var/lib/rancher/k3s/server/manifests/

# Copy cgroupv2 compatibility script
COPY k3s-base/cgroupv2-fix.sh /usr/local/bin/cgroupv2-fix.sh
RUN chmod +x /usr/local/bin/cgroupv2-fix.sh

# Copy wrapper entrypoint that handles cgroupv2 fix then delegates
COPY k3s-base/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directories needed by the session
RUN mkdir -p /tmp/easyshell /home

# The working directory for user commands
WORKDIR /home

# Override the default k3s entrypoint with our wrapper
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default command: run in k3s-session mode
CMD ["-mode", "k3s-session"]
