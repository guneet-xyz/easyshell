# Session Manager

## Overview

This is a Go application that manages the terminal sessions. It uses the port `4000` to communicate directly with the [website](../website/README.md) to manage the terminal sessions.

It creates and destroys containers for problem testcases as required by the website. See [entrypoint](../entrypoint/README.md) for more information.

The following environment variables are required to run this service. See [Environment Variables](../../README.md#environment-variables) for more information.

- `DOCKER_REGISTRY`
- `TOKEN`

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
