#!/bin/sh
# Docker entrypoint for EasyShell k3s containers.
# 1. Runs cgroupv2 fix (if needed)
# 2. Delegates to the EasyShell entrypoint binary

set -e

# Fix cgroupv2 if running on a cgroupv2 host
/usr/local/bin/cgroupv2-fix.sh

# Delegate to the EasyShell entrypoint
exec /entrypoint "$@"
