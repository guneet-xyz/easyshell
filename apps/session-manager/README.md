# Session Manager

## Overview

This is a Go application that manages the terminal sessions. It uses the port `4000` to communicate directly with the [website](../website/README.md) to manage the terminal sessions, and with the [submission-manager](../submission-manager/README.md) to run submission grading jobs.

It creates and destroys containers for problem testcases as required by the website. See [entrypoint](../entrypoint/README.md) for more information.

## Endpoints

All endpoints require the bearer token (see [`TOKEN`](#environment-variables)).

- `POST /create` - Create a new interactive terminal session container.
- `POST /exec` - Execute a command inside an existing session.
- `POST /is-running` - Check whether a session container is still running.
- `POST /kill` - Stop and remove a session container.
- `POST /run-submission` - Submit an async submission grading job. Returns a `job_id` immediately while the container runs in the background.
- `GET /run-submission/{job_id}` - Poll the status (`running`, `done`, `error`) and result of a previously submitted job.

See [`handlers/run-submission/PROTOCOL.md`](./handlers/run-submission/PROTOCOL.md) for the full `/run-submission` wire specification.

## Environment Variables

The following environment variables are required to run this service. See [Environment Variables](../../README.md#environment-variables) for more information.

- `DOCKER_REGISTRY` - Registry prefix for problem images. If unset, local images are used.
- `WORKING_DIR` - Absolute path for temporary files. Defaults to `/tmp/easyshell`.
- `TOKEN` - Bearer token clients must send in the `Authorization` header.
- `SUBMISSION_MAX_CONCURRENCY` - Maximum number of `/run-submission` jobs that may run concurrently. Defaults to `4`.

## Scripts

There isn't a script management system for this service. Use the following commands to achieve what you want.

- Format

  ```sh
  gofmt -w .
  ```

- Lint

  ```sh
  golangci-lint run
  ```

- Build `session-manager` binary

  ```sh
  go build
  ```

- Run `session-manager`

  ```sh
  ./session-manager
  ```
