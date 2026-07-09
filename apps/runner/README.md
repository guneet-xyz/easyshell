# Runner

Executes dispatched jobs. Owns the Docker socket on its host, launches problem containers, streams output back through the coordinator, and reports capacity.

See [Architecture](../../README.md#architecture) for a system overview.

## Deployment

Runners are pre-created by an admin via the website admin dashboard (`/admin/runners`). The operator receives `RUNNER_ID` and `RUNNER_TOKEN` and sets them in the runner's environment before starting the container.

On 401 (e.g., admin revoked the runner or rotated its token), the runner logs `runner.auth.rejected` once and drops to 60s heartbeat interval (does NOT crash). On operator env-swap + restart, the first successful heartbeat resets to the normal 5s cadence.

## Development

```bash
# Build
pnpm --filter @easyshell/runner build

# Run (requires env vars including RUNNER_ID + RUNNER_TOKEN)
pnpm --filter @easyshell/runner start
```

## Testing

See [TESTING.md](../../TESTING.md) for full testing documentation and conventions.

```bash
pnpm --filter @easyshell/runner test           # unit tests
pnpm --filter @easyshell/runner test:coverage  # unit tests + coverage
```
