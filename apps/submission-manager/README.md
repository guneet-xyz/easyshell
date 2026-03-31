# Queue Processor

## Overview

This is a typescript application that processes the submissions. It does not communicate directly with the [website](../website/README.md), but instead checks the submission queue in the database.

Also see [entrypoint](../entrypoint/README.md) for more information about the problem containers themselves.

Running the submission-manager requires the following environment variables. See [Environment Variables](../../README.md#environment-variables) for more information.

- `APP` - It should be set to `submission-manager`.
- `DRIZZLE_PROXY_URL`
- `DRIZZLE_PROXY_TOKEN`
- `DOCKER_REGISTRY` - If not provided, the local images will be used.
- `PROJECT_ROOT` - The root directory of the project. It is required if you are running the submission-manager outside of the git context.
- `WORKING_DIR` - If not provided, `/tmp/easyshell` is used.

## Scripts

Run scripts using `pnpm run <script>`.

- [`problems:cache`](#problemscache)
- [`build`](#build)
- [`start`](#start)

### `problems:cache`

Caches problems for the submission-manager.

Might require the following environment variables.

- `APP` - This is required and should be set to `script`. Already set in [package.json](./package.json).
- `PROJECT_ROOT` might need to be defined if the script is not run from within the git repository.

### `build`

Builds a single minified `.cjs` file using `esbuild`.

### `start`

Starts the submission-manager.
