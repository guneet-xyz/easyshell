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

# Stage 2: Final image based on rancher/k3s
FROM rancher/k3s:v1.32.3-k3s1

# Install additional tools needed by EasyShell and CKAD problems
# Note: rancher/k3s is based on scratch with a busybox-like environment,
# so we use the k3s built-in package mechanisms
# The k3s image includes: kubectl, crictl, ctr, k3s, and basic shell utilities

# Copy our entrypoint binary
COPY --from=build-entrypoint /bin/entrypoint /entrypoint

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
