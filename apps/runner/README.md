# Runner

Executes dispatched jobs. Owns the Docker socket on its host, launches problem containers, streams output back through the coordinator, and reports capacity.

See [Architecture](../../README.md#architecture) for a system overview.

## Development

```bash
# Build
pnpm --filter @easyshell/runner build

# Run (requires env vars including RUNNER_ID + RUNNER_SECRET after bootstrap)
pnpm --filter @easyshell/runner start
```

## Testing

See [TESTING.md](../../TESTING.md) for full testing documentation and conventions.

```bash
pnpm --filter @easyshell/runner test           # unit tests
pnpm --filter @easyshell/runner test:coverage  # unit tests + coverage
```
