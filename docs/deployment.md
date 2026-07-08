# Deployment

This guide covers the current deployment paths for easyshell after the Coordinator/Runner cutover.

## What gets deployed

| Artifact            | Source                               | Runtime role                                                                                              |
| ------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `website:latest`    | `apps/website/Dockerfile`            | Next.js frontend. Calls Coordinator for terminal sessions and submission grading.                         |
| `migrator` image    | `apps/migrator/Dockerfile`           | Runs Drizzle migrations before application services start.                                                |
| `coordinator` image | `apps/coordinator/Dockerfile`        | HTTP control plane. Owns queue polling, runner selection, retry procedures, and terminal-session routing. |
| `runner` image      | `apps/runner/Dockerfile`             | Executes jobs through Docker. Owns Docker socket access and embedded SQLite state.                        |
| problem images      | `packages/problems/scripts/build.ts` | Testcase containers tagged as `easyshell-{problemSlug}-{testcaseId}`.                                     |

The local Compose stack in `compose.yml` starts `migrator`, `coordinator`, `runner`, `runner-2`, and `website` by default. `session-manager` and `submission-manager` are legacy-profile placeholders only.

## Required infrastructure

- PostgreSQL reachable by `migrator`, `coordinator`, and `website`.
- Docker host(s) for runners with `/var/run/docker.sock` mounted into each runner container.
- External Docker network named `easyshell` for Compose deployments.
- Docker registry that stores:
  - `easyshell/website:latest`
  - `easyshell/migrator:latest`
  - `easyshell/coordinator:latest`
  - `easyshell/runner:latest`
  - problem images under `easyshell/easyshell-{problemSlug}-{testcaseId}`
- GitHub Actions environment named `registry-push` with registry and Tailscale credentials.

## GitHub Actions release paths

### Website image

Workflow: `.github/workflows/release-website.yml`

Triggers:

- push to `main` touching `apps/website/**`, `packages/**`, or the workflow file
- `workflow_dispatch`
- `workflow_call`

Pre-release gates:

- `test-tsc.yml`
- `test-formatting.yml`

Release steps:

1. Connect to Tailscale.
2. Log in to `${{ vars.DOCKER_REGISTRY }}`.
3. Build `apps/website/Dockerfile`.
4. Push `${{ vars.DOCKER_REGISTRY }}/easyshell/website:latest`.

Required GitHub environment variables:

| Name                      | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `DOCKER_REGISTRY`         | Registry hostname used for image tags.              |
| `POSTHOG_HOST`            | Build argument for the website image.               |
| `NEXT_PUBLIC_POSTHOG_KEY` | Public PostHog key compiled into the website image. |

Required GitHub secrets:

| Name                     | Purpose                         |
| ------------------------ | ------------------------------- |
| `DOCKER_USERNAME`        | Docker registry username.       |
| `DOCKER_PASSWORD`        | Docker registry password/token. |
| `TS_OAUTH_CLIENT_ID`     | Tailscale OAuth client id.      |
| `TS_OAUTH_CLIENT_SECRET` | Tailscale OAuth secret.         |

### Migrator image

Workflow: `.github/workflows/release-migrator.yml`

Triggers:

- push to `main` touching `apps/migrator/**`, `drizzle/**`, `drizzle.config.ts`, `packages/db/**`, workspace lockfiles, or the workflow file
- `workflow_dispatch`
- `workflow_call`

Pre-release gates:

- `test-tsc.yml`
- `test-formatting.yml`

Release steps:

1. Connect to Tailscale.
2. Log in to `${{ vars.DOCKER_REGISTRY }}`.
3. Build `apps/migrator/Dockerfile`.
4. Push `${{ vars.DOCKER_REGISTRY }}/easyshell/migrator:latest`.

Required GitHub environment variables and secrets match the Website image release path, except the migrator does not use website build arguments.

### Problem images

Workflow: `.github/workflows/release-problems.yml`

Trigger: `workflow_dispatch` with `problem` input. Use a problem slug or `all`.

Pre-release gate: `test-problems.yml` for the selected problem input.

Release steps:

1. Connect to Tailscale.
2. Log in to `${{ vars.DOCKER_REGISTRY }}`.
3. Install dependencies.
4. Run `pnpm run build ${{ inputs.problem }}` in `packages/problems`.
5. Run `pnpm run push ${{ inputs.problem }}` in `packages/problems` with `DOCKER_REGISTRY` set.

Problem image tags are generated as:

```text
easyshell-{problemSlug}-{testcaseId}
```

When `DOCKER_REGISTRY` is set, the push script tags and pushes each image as:

```text
${DOCKER_REGISTRY}/easyshell/easyshell-{problemSlug}-{testcaseId}
```

### Release all

`.github/workflows/release-all.yml` releases the application runtime images together:

- `release-website.yml` for the website image
- `release-migrator.yml` for the database migrator image
- `release-coordinator.yml` for the coordinator image
- `release-runner.yml` for the runner image

Release testcase containers separately with:

- `release-problems.yml` for testcase images

## Runtime environment

### Coordinator

| Variable                         | Required    | Notes                                                                                                        |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                   | yes         | PostgreSQL connection string.                                                                                |
| `COORDINATOR_TOKEN`              | yes         | Bearer token used by the website. Must match website `COORDINATOR_TOKEN`.                                    |
| `COORDINATOR_REGISTRATION_TOKEN` | yes         | Bootstrap token used by runners.                                                                             |
| `COORDINATOR_PORT`               | no          | Defaults to `4100`.                                                                                          |
| `MAX_ATTEMPTS`                   | no          | Defaults to `3`.                                                                                             |
| `LOG_LEVEL`                      | no          | One of `trace`, `debug`, `info`, `warn`, `error`, `fatal`.                                                   |
| `NODE_ENV`                       | no          | Use `production` for deployed services.                                                                      |
| `COORDINATOR_SECRET_KEY`         | recommended | 64 hex chars. Enables AES-GCM storage for runner secrets. Without it, dev/test plaintext envelopes are used. |

### Runner

| Variable                         | Required        | Notes                                                                               |
| -------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `RUNNER_NAME`                    | yes             | Human-readable runner name.                                                         |
| `RUNNER_PUBLIC_URL`              | yes             | URL the coordinator uses to call the runner.                                        |
| `COORDINATOR_URL`                | yes             | Coordinator HTTP URL.                                                               |
| `COORDINATOR_REGISTRATION_TOKEN` | yes             | Must match coordinator registration token.                                          |
| `RUNNER_ID`                      | after bootstrap | Persisted runner id printed by bootstrap.                                           |
| `RUNNER_SECRET`                  | after bootstrap | Persisted runner secret printed by bootstrap.                                       |
| `RUNNER_DB_PATH`                 | no              | Defaults to `/var/lib/easyshell-runner/runner.db`. Persist this path with a volume. |
| `WORKING_DIR`                    | no              | Defaults to `/tmp/easyshell`. Mount this if you need host-visible work directories. |
| `SUBMISSION_MAX_CONCURRENCY`     | no              | Defaults to `4`.                                                                    |
| `SESSION_MAX_CONCURRENCY`        | no              | Defaults to `64`.                                                                   |
| `DOCKER_REGISTRY`                | optional        | Prefix used when pulling testcase images.                                           |
| `LOG_LEVEL`                      | no              | Use `info` or `warn` in production.                                                 |
| `NODE_ENV`                       | no              | Use `production` for deployed services.                                             |

### Website

| Variable                                                        | Required          | Notes                                                        |
| --------------------------------------------------------------- | ----------------- | ------------------------------------------------------------ |
| `DATABASE_URL`                                                  | yes               | PostgreSQL connection string.                                |
| `NEXTAUTH_SECRET`                                               | yes               | NextAuth secret.                                             |
| `NEXTAUTH_URL`                                                  | yes               | Public website URL.                                          |
| `COORDINATOR_URL`                                               | yes               | URL reachable from the website container to the coordinator. |
| `COORDINATOR_TOKEN`                                             | yes               | Must match coordinator `COORDINATOR_TOKEN`.                  |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`                   | yes               | OAuth provider credentials.                                  |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`                     | yes               | OAuth provider credentials.                                  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                     | yes               | OAuth provider credentials.                                  |
| `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_MAIL_FROM` | yes               | Mail delivery.                                               |
| `POSTHOG_HOST`                                                  | yes               | Server-side PostHog host.                                    |
| `NEXT_PUBLIC_POSTHOG_KEY`                                       | yes at build time | Public PostHog key.                                          |

## Coordinator and Runner rollout

1. Apply database migrations before starting application services.

   ```sh
   DATABASE_URL=postgres://... pnpm exec drizzle-kit migrate
   ```

   The Compose stack does this through the `migrator` service.

2. Start the coordinator with its production environment.

   ```sh
   docker run --rm \
     -e DATABASE_URL=postgres://... \
     -e COORDINATOR_TOKEN=... \
     -e COORDINATOR_REGISTRATION_TOKEN=... \
     -e COORDINATOR_SECRET_KEY=... \
     -e NODE_ENV=production \
     -p 4100:4100 \
     coordinator-image
   ```

3. Bootstrap each runner once without `RUNNER_ID` and `RUNNER_SECRET`.

   The runner registers with the coordinator, prints credentials to stderr, and exits:

   ```text
   BOOTSTRAP-ME: runner_id=... runner_secret=...
   ```

4. Persist `RUNNER_ID` and `RUNNER_SECRET` in the runner's deployment secrets.

5. Restart the runner with `RUNNER_ID` and `RUNNER_SECRET` set.

   ```sh
   docker run --rm \
     -e RUNNER_ID=... \
     -e RUNNER_SECRET=... \
     -e RUNNER_NAME=runner-1 \
     -e RUNNER_PUBLIC_URL=http://runner-1:4200 \
     -e COORDINATOR_URL=http://coordinator:4100 \
     -e COORDINATOR_REGISTRATION_TOKEN=... \
     -e RUNNER_DB_PATH=/var/lib/easyshell-runner/runner.db \
     -e NODE_ENV=production \
     -v /var/run/docker.sock:/var/run/docker.sock \
     -v runner-data:/var/lib/easyshell-runner \
     -p 4200:4200 \
     runner-image
   ```

6. Confirm the runner heartbeats appear in the database.

   ```sql
   SELECT id, name, status, last_seen_at
   FROM easyshell_runner
   ORDER BY last_seen_at DESC;
   ```

## Compose rollout

For a single-host rollout matching the local topology:

```sh
docker network create easyshell || true
docker compose build migrator coordinator runner runner-2 website
docker compose run --rm migrator
docker compose up -d coordinator runner runner-2 website
```

Required `.env` values are the variables listed above. The default `compose.yml` uses development tokens for local use; production deployments must override those values through secrets or environment-specific Compose files.

Check service health:

```sh
curl -fsS http://localhost:4100/health.ping
curl -fsS http://localhost:4200/health.ping
curl -fsS http://localhost:3000
```

## Website rollout

1. Release the website image through GitHub Actions or build it manually.

   ```sh
   docker build . \
     -f ./apps/website/Dockerfile \
     -t ${DOCKER_REGISTRY}/easyshell/website:latest \
     --build-arg POSTHOG_HOST=${POSTHOG_HOST} \
     --build-arg NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}
   docker push ${DOCKER_REGISTRY}/easyshell/website:latest
   ```

2. Deploy the pushed image with runtime environment variables, including `COORDINATOR_URL` and `COORDINATOR_TOKEN`.

3. Verify the site responds and can reach the coordinator.

   ```sh
   curl -fsS https://easyshell.sh
   ```

## Problem image rollout

Release all problem images:

```sh
DOCKER_REGISTRY=registry.example.com pnpm --filter @easyshell/problems run build all
DOCKER_REGISTRY=registry.example.com pnpm --filter @easyshell/problems run push all
```

Release one problem:

```sh
DOCKER_REGISTRY=registry.example.com pnpm --filter @easyshell/problems run build list-files
DOCKER_REGISTRY=registry.example.com pnpm --filter @easyshell/problems run push list-files
```

Runners pull testcase images by name. If `DOCKER_REGISTRY` is set on the runner, it prefixes image names as:

```text
${DOCKER_REGISTRY}/easyshell/easyshell-{problemSlug}-{testcaseId}
```

## Post-deploy verification

Run these after any deployment:

```sh
pnpm test
pnpm test:e2e
scripts/smoke-coordinator-runner.sh
scripts/multi-runner-check.sh
```

For production smoke tests, set `DATABASE_URL`, `COORDINATOR_URL`, and `COORDINATOR_TOKEN` to production-safe values. Do not run synthetic submissions against production unless the selected account/problem data is safe for smoke traffic.

## Rollback

Website rollback is an image rollback:

1. Re-point the deployment to the previous `website` image tag.
2. Restart the website service.
3. Verify `COORDINATOR_URL` and `COORDINATOR_TOKEN` still match the running coordinator.

Problem image rollback is a registry tag rollback:

1. Re-tag the last known-good testcase image.
2. Push it back to the same `easyshell/easyshell-{problemSlug}-{testcaseId}` tag.
3. Restart affected runners if they have cached stale images.

Coordinator/Runner rollback depends on schema compatibility. The coordinator-runner migration adds queue and runner tables used by the new runtime; do not roll back to legacy `session-manager` or `submission-manager` services unless you have also restored their source and deployment definitions. The Compose legacy-profile services are placeholders for rollback drills, not full production services.

## Troubleshooting

### `docker login` fails in GitHub Actions

Check the `registry-push` environment:

- `vars.DOCKER_REGISTRY`
- `secrets.DOCKER_USERNAME`
- `secrets.DOCKER_PASSWORD`

This failure happens before repository code is checked out, so it is usually an environment or credential issue.

### Runner exits after boot

If stderr contains `BOOTSTRAP-ME`, the runner successfully registered and intentionally exited. Persist `RUNNER_ID` and `RUNNER_SECRET`, then restart it with both variables set.

### Runner cannot start containers

Confirm:

- `/var/run/docker.sock` is mounted.
- the runner container has Docker CLI installed.
- the `easyshell` Docker network exists if testcase containers need that network.
- `DOCKER_REGISTRY` points at the registry where problem images were pushed.

### Website cannot grade or open terminals

Confirm:

- website `COORDINATOR_URL` reaches the coordinator from inside the website runtime.
- website `COORDINATOR_TOKEN` matches coordinator `COORDINATOR_TOKEN`.
- at least one runner is `active` with positive submission/session capacity.
