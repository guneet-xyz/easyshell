#!/bin/sh
# cgroupv2 compatibility fix for running k3s inside Docker containers.
# Evacuates processes from the root cgroup to /init so subtree controllers
# can be enabled. This is required when running with --cgroupns=private
# on hosts with cgroupv2.
#
# Based on k3d's cgroupv2 fix:
# https://github.com/k3d-io/k3d/blob/main/pkg/types/fixes/assets/k3d-entrypoint-cgroupv2.sh

set -e

if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
	echo "[cgroupv2-fix] Evacuating root cgroup..."

	# Move processes from root cgroup to /init cgroup
	mkdir -p /sys/fs/cgroup/init
	xargs -rn1 </sys/fs/cgroup/cgroup.procs >/sys/fs/cgroup/init/cgroup.procs 2>/dev/null || true

	# Enable all available controllers for subtrees
	sed -e 's/ / +/g' -e 's/^/+/' </sys/fs/cgroup/cgroup.controllers \
		>/sys/fs/cgroup/cgroup.subtree_control 2>/dev/null || true

	echo "[cgroupv2-fix] Done"
fi
