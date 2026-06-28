# Coordinator

Central control plane. Accepts work from the website (interactive terminal sessions, submission grading), polls the queued submissions table, and dispatches jobs to registered runners.

See [Architecture](../../README.md#architecture) for a system overview.

## Development

```bash
# Build
pnpm --filter @easyshell/coordinator build

# Run (requires env vars)
pnpm --filter @easyshell/coordinator start
```

## Testing

See [TESTING.md](../../TESTING.md) for full testing documentation and conventions.

```bash
pnpm --filter @easyshell/coordinator test           # unit tests
pnpm --filter @easyshell/coordinator test:coverage  # unit tests + coverage
```
