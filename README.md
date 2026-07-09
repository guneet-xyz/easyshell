# easyshell - overview

**easyshell** is a platform for trying, learning and mastering shell commands. See it for yourself - [easyshell.sh](https://easyshell.sh).

## Quick Links

- [Overview](#easyshell---overview)
  - [Architecture and Features](#architecture-and-features)
    - [Website](apps/website/README.md)
    - [Coordinator](apps/coordinator/README.md)
    - [Runner](apps/runner/README.md)
    - [Entrypoint](apps/entrypoint/README.md)
- [Development Guide](#development-guide)
  - [Pre-Requisites](#pre-requisites)
  - [Local Docker setup](#local-docker-setup)
  - [Environment Variables](#environment-variables)
  - [Scripts](#scripts)
  - [Problems](#problems)
- [Deployment Guide](docs/deployment.md)

## Architecture and Features

### Services

There are a few microservices that work together to make the platform work.

![architecture.svg](./.github/assets/architecture.svg)

- #### Website

  Frontend for [easyshell.sh](https://easyshell.sh). See [Website](apps/website/README.md) for more information.

- #### Coordinator

  Central control plane. Accepts work from the website (interactive terminal sessions, submission grading), polls the queued submissions table, and dispatches jobs to registered runners. See [Coordinator](apps/coordinator/README.md) for more information.

- #### Runner

  Executes the dispatched jobs. Owns the Docker socket on its host, launches the problem containers, streams output back through the coordinator, and reports capacity. See [Runner](apps/runner/README.md) for more information.

- #### Entrypoint

  Entrypoint for all testcase images. See [Entrypoint](apps/entrypoint/README.md) for more information.

---

## Development Guide

In this section,

- [Pre-Requisites](#pre-requisites)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Problems](#problems)

### Pre-Requisites

- Node (v22.14.0) and NPM (10.9.2) (can be installed using `nvm install 22`. see [nvm](https://github.com/nvm-sh/nvm))
- Go (1.23.6)
- Docker

### Local Docker setup

The quickest way to run the application stack locally is through Docker Compose.

1. Install dependencies.

   ```sh
   corepack enable
   pnpm install
   ```

2. Create the external network used by the app and the session containers.

   ```sh
   docker network create easyshell
   ```

   If the network already exists, Docker will report that and you can continue.

3. Make sure your dev secrets are available through Infisical. At minimum, the Compose stack needs `DATABASE_URL`; the website also needs the auth, SMTP and PostHog variables listed below.

4. Build and run the stack.

   ```sh
   pnpm run docker:build
   pnpm run docker:up
   ```

The `docker:up` command boots the base services (migrator, coordinator, and website). Runners are profile-gated and do not start by default. For full local development including runners, use:

```sh
pnpm run docker:up:full
```

> **Warning**: Starting runners without seeding first causes a 60s auth-backoff. Always run `pnpm run dev:seed-runners` before starting runners.

The base `docker:up` stack starts these services:

- `migrator` - runs `drizzle-kit migrate` and exits. Application services wait for it to finish successfully.
- `coordinator` - HTTP control plane on <http://localhost:4100>. Accepts session/submission requests from the website and polls the submission queue.
- `website` - serves the Next.js app on <http://localhost:3000>.

Run migrations without starting the full stack with:

```sh
pnpm run docker:migrate
```

For non-Docker development, run migrations directly before starting the app processes:

```sh
pnpm run db:migrate
pnpm run dev:website
```

Run the coordinator and runner directly via Go / pnpm in their respective `apps/coordinator` and `apps/runner` directories (see each app's README for the exact commands).

### Environment Variables

The following environment variables might be required

- [`APP`](#app)
- [`PROJECT_ROOT`](#project_root)
- [`WORKING_DIR`](#working_dir)
- [`DOCKER_REGISTRY`](#docker_registry)
- [`DATABASE_URL`](#database_url)
- [`COORDINATOR_URL`](#coordinator_url)
- [`WEBSITE_TOKEN`](#website_token)
- [`ADMIN_EMAILS`](#admin_emails)
- [`NEXTAUTH_URL`](#nextauth_url)
- [`NEXTAUTH_SECRET`](#nextauth_secret)
- [`DISCORD_CLIENT_ID`](#discord_client_id)
- [`DISCORD_CLIENT_SECRET`](#discord_client_secret)
- [`GITHUB_CLIENT_ID`](#github_client_id)
- [`GITHUB_CLIENT_SECRET`](#github_client_secret)
- [`GOOGLE_CLIENT_ID`](#google_client_id)
- [`GOOGLE_CLIENT_SECRET`](#google_client_secret)

#### `APP`

This is a helper variable that is used to determine which environment variables to load and verify.
Possible values are - `website` and `script`.

#### `PROJECT_ROOT`

To run certain scripts, the _project root_ is automatically determined using `git rev-parse --show-toplevel` when within a git context. If running outside of one, please set the `PROJECT_ROOT` environment variable manually.

#### `WORKING_DIR`

Directory for temporary files. If not specified, `/tmp/easyshell` is used.

#### `DOCKER_REGISTRY`

Docker registry to use for pushing images. This is required for pushing images to the registry. If unset, the images will not be pushed.

If you are using a registry, then make sure you are already logged in.

#### `DATABASE_URL`

Database connection string.

### `DRIZZLE_PROXY_URL`

URL of the drizzle proxy.

### `DRIZZLE_PROXY_TOKEN`

Token for the drizzle proxy.

#### `COORDINATOR_URL`

URL of the coordinator HTTP API. Used by the website to request interactive terminal sessions and to dispatch submission grading. For cloudflare deployment, this cannot be a fixed IP address.

#### `WEBSITE_TOKEN`

Bearer token used by the website when calling the coordinator API.

#### `ADMIN_EMAILS`

Comma-separated list of email addresses with admin access to the website admin dashboard.

#### `NEXTAUTH_SECRET`

#### `DISCORD_CLIENT_ID`

#### `DISCORD_CLIENT_SECRET`

#### `GITHUB_CLIENT_ID`

#### `GITHUB_CLIENT_SECRET`

#### `GOOGLE_CLIENT_ID`

#### `GOOGLE_CLIENT_SECRET`

These are the [NextAuth](https://authjs.dev) configuration variables. These are **required** for running the Next.js application.

### Scripts

Many scripts have been defined in the [package.json](package.json).
This section will go over these scripts and the additional steps or environment variables required for their execution.

Also see [Next.js Scripts](apps/website/README.md#scripts) and [Script Scripts](apps/script/README.md#scripts) for more information.

- [`lint:tsc`](#linttsc)
- [`lint:next`](#lintnext)
- [`db:migrate`](#dbmigrate)
- [`docker:build`](#dockerbuild)
- [`docker:migrate`](#dockermigrate)
- [`docker:up`](#dockerup)
- [`docker:up:full`](#dockerupfull)
- [`dev:seed-runners`](#devseed-runners)
- [`format:check`](#formatcheck)
- [`format:write`](#formatwrite)
- [`problems:new`](#problemsnew)
- [`problems:lint`](#problemslint)
- [`problems:build`](#problemsbuild)
- [`problems:build-pkg`](#problemsbuild-pkg)

#### `lint:tsc`

Lint the entire TS/JS codebase using `tsc`.

#### `lint:next`

Lint the Next.js codebase using `next lint`.

#### `db:migrate`

Runs the Drizzle migrations in [`drizzle`](./drizzle) against `DATABASE_URL` using Infisical's `dev` environment.

#### `docker:build`

Builds the Docker Compose services for local development.

#### `docker:migrate`

Runs the `migrator` Compose service once and removes the container after it exits. Use this when you only need to apply database migrations.

#### `docker:up`

Starts the local Docker Compose stack in the background. The `migrator` service runs first; `coordinator` and `website` start only after migrations complete successfully. Runners are not started (profile-gated).

#### `docker:up:full`

Starts the full Docker Compose stack including runners. Equivalent to running `docker:up`, then `dev:seed-runners`, then `docker compose --profile runners up -d runner runner-2`.

#### `dev:seed-runners`

Seeds the database with pre-created runner records. Runs `tsx scripts/dev-seed-runner.ts`. Must be executed before starting runners to avoid 60s auth-backoff.

#### `format:check`

Check formatting for the entire codebase using `prettier` and `gofmt`.

#### `format:write`

Format the entire codebase using `prettier` and `gofmt`.

#### `problems:new`

Create a new problem.

Might require the following environment variables.

- `APP=script`
- `PROJECT_ROOT` might need to be defined if the script is not run from within the git repository.

#### `problems:lint`

Lint the problem configuration files.

Might require the following environment variables.

- `APP` - This is required and should be set to `script`. Already set in [package.json](package.json).
- `PROJECT_ROOT` might need to be defined if the script is not run from within the git repository.

#### `problems:test`

Test the problem images using tests defined in the problem configs.

Might require the following environment variables.

- `PROJECT_ROOT` might need to be defined if the script is not run from within the git repository.

#### `problems:build`

Build (and push) the problem images.

Might require the following environment variables.

- `APP` - This is required and should be set to `script`. Already set in [package.json](package.json).
- `PROJECT_ROOT` - required if the script is not run from within the git repository.
- `DOCKER_REGISTRY` - required if the images need to be pushed to a registry.
- `WORKING_DIR` - optional, defaults to `/tmp/easyshell`.

#### `problems:cache:website`

Calls [`problems:cache`](./apps/website/README.md#problemscache) in [website](./apps/website/README.md) app.

#### `problems:cache`

Alias for [`problems:cache:website`](#problemscachewebsite).

### Problems

All problems for easyshell are stored in the [problems/](problems) directory. They have a strict structure, which dictates the problem's behaviour and affects its build process.

#### Problem Structure

- [`page.md`](#pagemd)
- [`hints/`](#hints)
- [`hints/<hint-id>.md`](#hintshint-idmd)
- [`testcases/`](#testcases)
- [`testcases/<testcase-id>/`](#testcasestestcase-id)
- [`config.ts`](#configts)

##### `page.md`

Explanation of the problem. For consistency, it should contain only two top-level headings - `Problem Statement` and `Instructions`.
This file is **required**.

##### `hints/`

Folder containing hints for the problem.
This folder is **optional**.

##### `hints/<hint-id>.md`

Hint for the problem. `<hint-id>` must begin from `1` and can only increase sequentially from there on.

##### `testcases/`

Folder containing testcases for the problem.
This folder is **required**.

##### `testcases/<testcase-id>/`

Folder containing the files for the testcase. `<testcase-id>` must begin from `1` and can only increase sequentially from there on.

At least one public testcase is required.

##### `config.ts`

This file contains the configuration for the problem. It is **required**.
