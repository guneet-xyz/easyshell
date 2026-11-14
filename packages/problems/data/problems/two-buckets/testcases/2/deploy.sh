#!/bin/sh
echo "Starting deploy #1337"
echo "error: database migration 0042_add_kevin_table failed" >&2
echo "Retrying migration..."
echo "error: still failing. Have you tried turning it off and on again?" >&2
echo "Rolling back to yesterday's version"
echo "fatal: yesterday's version also had bugs, but at least they were familiar ones" >&2
echo "Deploy complete (technically)"
exit 1
