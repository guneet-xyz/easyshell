# Mustang

## Overview

Mustang is the container orchestration service for EasyShell. It manages Docker containers for terminal sessions, submissions, and warm container pooling. It communicates via HTTP on port `4000` with the [website](../website/README.md), [submission-manager](../submission-manager/README.md), and [cron](../cron/README.md) services.

It creates, monitors, and destroys containers for problem testcases. See [entrypoint](../entrypoint/README.md) for more information on what runs inside those containers.

## Environment Variables

| Variable          | Required | Default          | Description                                                 |
| ----------------- | -------- | ---------------- | ----------------------------------------------------------- |
| `DATABASE_URL`    | Yes      | —                | PostgreSQL connection string                                |
| `MUSTANG_TOKEN`   | Yes      | —                | Bearer token for API authentication (falls back to `TOKEN`) |
| `DOCKER_REGISTRY` | No       | `""`             | Private registry prefix for images                          |
| `WORKING_DIR`     | No       | `/tmp/easyshell` | Host directory for session volumes                          |
| `PORT`            | No       | `4000`           | HTTP server port                                            |

## Scripts

- **Dev** (runs with tsx, no build required):

  ```sh
  pnpm run dev
  ```

- **Build** (bundles into a single CJS file via esbuild):

  ```sh
  pnpm run build
  ```

- **Start** (runs the bundled CJS file):

  ```sh
  pnpm run start
  ```
