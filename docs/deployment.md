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

The local Compose stack in `compose.yml` starts `migrator`, `coordinator`, and `website` by default. `runner` and `runner-2` sit behind the `runners` Compose profile and are started explicitly (either directly with `docker compose --profile runners up -d runner runner-2`, or via `pnpm run docker:up:full`, which also seeds the two dev runner rows so their fixed tokens work). `session-manager` and `submission-manager` are legacy-profile placeholders only.

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

| Variable                 | Required    | Notes                                                                                                        |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`           | yes         | PostgreSQL connection string.                                                                                |
| `WEBSITE_TOKEN`          | yes         | Bearer token used by the website. Must match website `WEBSITE_TOKEN`.                                        |
| `COORDINATOR_PORT`       | no          | Defaults to `4100`.                                                                                          |
| `MAX_ATTEMPTS`           | no          | Defaults to `3`.                                                                                             |
| `LOG_LEVEL`              | no          | One of `trace`, `debug`, `info`, `warn`, `error`, `fatal`.                                                   |
| `NODE_ENV`               | no          | Use `production` for deployed services.                                                                      |
| `COORDINATOR_SECRET_KEY` | recommended | 64 hex chars. Enables AES-GCM storage for runner secrets. Without it, dev/test plaintext envelopes are used. |

### Runner

| Variable                     | Required | Notes                                                                                                   |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `RUNNER_ID`                  | yes      | Server-issued runner id. Copy from the admin UI at `/admin/runners` after clicking **Create runner**.   |
| `RUNNER_TOKEN`               | yes      | Server-issued bearer token, shown ONCE in the admin UI. Rotate via **Rotate token**; store as a secret. |
| `RUNNER_NAME`                | yes      | Human-readable runner name.                                                                             |
| `RUNNER_PUBLIC_URL`          | yes      | URL the coordinator uses to call the runner.                                                            |
| `COORDINATOR_URL`            | yes      | Coordinator HTTP URL.                                                                                   |
| `RUNNER_DB_PATH`             | no       | Defaults to `/var/lib/easyshell-runner/runner.db`. Persist this path with a volume.                     |
| `WORKING_DIR`                | no       | Defaults to `/tmp/easyshell`. Mount this if you need host-visible work directories.                     |
| `SUBMISSION_MAX_CONCURRENCY` | no       | Defaults to `4`.                                                                                        |
| `SESSION_MAX_CONCURRENCY`    | no       | Defaults to `64`.                                                                                       |
| `DOCKER_REGISTRY`            | optional | Prefix used when pulling testcase images.                                                               |
| `LOG_LEVEL`                  | no       | Use `info` or `warn` in production.                                                                     |
| `NODE_ENV`                   | no       | Use `production` for deployed services.                                                                 |

### Website

| Variable                                                        | Required          | Notes                                                                                                |
| --------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                  | yes               | PostgreSQL connection string.                                                                        |
| `NEXTAUTH_SECRET`                                               | yes               | NextAuth secret.                                                                                     |
| `NEXTAUTH_URL`                                                  | yes               | Public website URL.                                                                                  |
| `COORDINATOR_URL`                                               | yes               | URL reachable from the website container to the coordinator.                                         |
| `WEBSITE_TOKEN`                                                 | yes               | Bearer token used to authenticate website→coordinator calls. Must match coordinator `WEBSITE_TOKEN`. |
| `ADMIN_EMAILS`                                                  | yes               | Comma-separated list of user emails granted access to `/admin/*` routes (including runner CRUD).     |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`                   | yes               | OAuth provider credentials.                                                                          |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`                     | yes               | OAuth provider credentials.                                                                          |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                     | yes               | OAuth provider credentials.                                                                          |
| `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_MAIL_FROM` | yes               | Mail delivery.                                                                                       |
| `POSTHOG_HOST`                                                  | yes               | Server-side PostHog host.                                                                            |
| `NEXT_PUBLIC_POSTHOG_KEY`                                       | yes at build time | Public PostHog key.                                                                                  |

## Coordinator and Runner rollout

Runners are provisioned by an admin via the website's `/admin/runners` UI (backed by the coordinator's `admin.runners.*` tRPC procedures). There is no runner self-registration. Do migrations first, boot the control plane, then create+start each runner.

1. Apply database migrations before starting application services.

   ```sh
   DATABASE_URL=postgres://... pnpm exec drizzle-kit migrate
   ```

   The Compose stack does this through the `migrator` service.

2. Boot the coordinator and the website with their production environment. The coordinator needs `WEBSITE_TOKEN`; the website needs the matching `WEBSITE_TOKEN` plus `ADMIN_EMAILS`.

   ```sh
   docker run --rm -d \
     --name coordinator \
     -e DATABASE_URL=postgres://... \
     -e WEBSITE_TOKEN=... \
     -e COORDINATOR_SECRET_KEY=... \
     -e NODE_ENV=production \
     -p 4100:4100 \
     coordinator-image

   docker run --rm -d \
     --name website \
     -e DATABASE_URL=postgres://... \
     -e COORDINATOR_URL=http://coordinator:4100 \
     -e WEBSITE_TOKEN=... \
     -e ADMIN_EMAILS="admin@example.com,ops@example.com" \
     -e NEXTAUTH_SECRET=... \
     -e NEXTAUTH_URL=https://easyshell.example.com \
     -e NODE_ENV=production \
     -p 3000:3000 \
     website-image
   ```

3. Log in to the website as one of the `ADMIN_EMAILS` users, open `/admin/runners`, and click **Create runner**. Enter the runner's `name` and `public_url`, then submit. The UI shows the newly issued `runner_id` and `runner_token` **exactly once** — copy both immediately.

4. Persist `RUNNER_ID` and `RUNNER_TOKEN` in the runner's deployment secrets.

5. Start the runner container with those secrets.

   ```sh
   docker run --rm -d \
     --name runner-1 \
     -e RUNNER_ID=... \
     -e RUNNER_TOKEN=... \
     -e RUNNER_NAME=runner-1 \
     -e RUNNER_PUBLIC_URL=http://runner-1:4200 \
     -e COORDINATOR_URL=http://coordinator:4100 \
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

For local development, the whole flow above collapses to a single command:

```sh
pnpm run docker:up:full
```

That script boots `migrator` + `coordinator` + `website`, runs `scripts/dev-seed-runner.ts` to insert two pre-provisioned dev runners (`dev-runner-1` and `dev-runner-2` with fixed tokens matching `compose.yml`), then starts the runners under the `runners` Compose profile.

### Post-revoke rotation lifecycle

When an admin clicks **Revoke** or **Rotate token** in `/admin/runners`, the affected runner's next authenticated request to the coordinator receives HTTP `401 Unauthorized`. On that response the runner enters a shared auth-blocked state:

1. **Auth-blocked flag flips on.** The runner stops accepting new dispatches, drains in-flight work, and skips all outbound calls that require a bearer token (heartbeat, `jobs.reportResult`, `jobs.reportProgress`, capacity reports).
2. **Backoff-only probing.** A single background probe re-tries `runners.heartbeat` with exponential backoff (jittered; capped at 5 minutes between attempts, never gives up). No other tokens or credentials are ever guessed — the runner only re-tries with the value currently in `RUNNER_TOKEN`.
3. **Cutover on success.** As soon as a probe succeeds, the auth-blocked flag clears atomically, queued push-retry work resumes, and the runner resumes accepting dispatches on its next heartbeat ack.
4. **Operator action:** for a revoked runner, delete the container or update `RUNNER_TOKEN` to a freshly rotated value. For a rotated runner, redeploy with the new `RUNNER_TOKEN` value from the admin UI; the probe will accept it on its next attempt.

The runner never logs the bearer value. Auth-blocked and cutover transitions are emitted as structured `warn` / `info` logs with the runner id and a monotonically increasing attempt counter so on-call can observe recovery without inspecting secrets.

### Token rotation

**Rotate token** on `/admin/runners` performs an R1 instant-cutover rotation. Semantics:

- **Single active token.** At any point in time exactly one bearer token is valid for a given `RUNNER_ID`. Rotating replaces the coordinator-side `secret_hash` + `secret_ciphertext` + `secret_nonce` atomically inside one Postgres transaction; the previous token stops working the instant the transaction commits. There is no dual-key overlap window.
- **UI shows new token once.** The admin UI displays the fresh `runner_token` a single time, then never again. Copy it before dismissing the dialog.
- **Runner reaction is the same as revoke.** The old-token runner enters the [post-revoke rotation lifecycle](#post-revoke-rotation-lifecycle) above. It stays auth-blocked until its `RUNNER_TOKEN` env var is updated to the new value AND the runner picks that value up (redeploy, restart, or secret-manager rollout).
- **No dispatch loss inside the runner.** Because the runner drains in-flight work when it goes auth-blocked and buffers unpushed results in local SQLite (`accepted_job.push_acked = 0`), rotating during an active job does not lose the result — it will be pushed on the first successful heartbeat after cutover.
- **Coordinator-side dispatch skip.** While the runner is auth-blocked, the coordinator's `runner-picker` skips it (revoked runners are filtered by the `WHERE revoked_at IS NULL` guard). Once the new token is in place and heartbeat resumes, the picker considers it again.

#### Concurrent rotation (two admins)

If two admins rotate the same runner simultaneously, the dashboard may show a `409 CONFLICT` error. The exact guidance shown in the UI is:

Another admin rotated this runner's token while you were preparing this rotation (409 CONFLICT). Refresh the page and coordinate with the other admin before retrying: (1) if they already copied the winning token and deployed the runner, DO NOT retry — the runner is already reachable and retrying would invalidate the working token; (2) if the winning token was not captured (browser refreshed / walked away) or should be invalidated for policy reasons, rotate again to generate a fresh token. The other admin's plaintext token cannot be recovered from the dashboard — it was view-once.

For scheduled key hygiene (compliance rotations), run rotate during a maintenance window and coordinate the runner-side `RUNNER_TOKEN` update within the same window; anything that dispatched to that runner before cutover is safe (buffered locally), anything that would dispatch during the gap is routed to a different active runner or waits in queue.

## Compose rollout

For a single-host rollout matching the local topology, use the convenience script:

```sh
docker network create easyshell || true
pnpm run docker:build
pnpm run docker:up:full
```

`pnpm run docker:up:full` runs the migrator, boots `coordinator` + `website`, seeds the two dev runner rows (`dev-runner-1` and `dev-runner-2` with the fixed `dev-runner-token-{1,2}` tokens hard-coded in `compose.yml`), then starts the runner containers under the `runners` profile.

If you need to run the steps manually (for a production single-host rollout with real credentials):

```sh
docker network create easyshell || true
docker compose build migrator coordinator runner runner-2 website
docker compose run --rm migrator
docker compose up -d coordinator website
# provision each runner via /admin/runners in the website, then:
docker compose --profile runners up -d runner runner-2
```

Required `.env` values are the variables listed above. The default `compose.yml` uses development tokens for local use; production deployments must override those values through secrets or environment-specific Compose files, and each runner's `RUNNER_ID` / `RUNNER_TOKEN` pair must be issued out of band via the admin UI.

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

2. Deploy the pushed image with runtime environment variables, including `COORDINATOR_URL`, `WEBSITE_TOKEN`, and `ADMIN_EMAILS`.

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

For production smoke tests, set `DATABASE_URL`, `COORDINATOR_URL`, and `WEBSITE_TOKEN` to production-safe values. Do not run synthetic submissions against production unless the selected account/problem data is safe for smoke traffic.

## Rollback

Website rollback is an image rollback:

1. Re-point the deployment to the previous `website` image tag.
2. Restart the website service.
3. Verify `COORDINATOR_URL` and `WEBSITE_TOKEN` still match the running coordinator.

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

The runner no longer self-registers, so the old `BOOTSTRAP-ME` message is gone. If a runner crash-loops immediately after boot, check its logs for one of these:

- `RUNNER_ID is required` or `RUNNER_TOKEN is required` — the env vars were not set. Create the runner in `/admin/runners` (or run `pnpm run dev:seed-runners` locally), copy the id + token, and set both.
- `401 Unauthorized` from the coordinator — the `RUNNER_TOKEN` value does not match the coordinator's stored hash for this `RUNNER_ID`. Either the runner was revoked, rotated, or the token was pasted wrong. See [Post-revoke rotation lifecycle](#post-revoke-rotation-lifecycle) for the recovery path.
- `runner not found` — the `RUNNER_ID` does not exist in `easyshell_runner` at all. Create it via `/admin/runners`.

### Runner cannot start containers

Confirm:

- `/var/run/docker.sock` is mounted.
- the runner container has Docker CLI installed.
- the `easyshell` Docker network exists if testcase containers need that network.
- `DOCKER_REGISTRY` points at the registry where problem images were pushed.

### Website cannot grade or open terminals

Confirm:

- website `COORDINATOR_URL` reaches the coordinator from inside the website runtime.
- website `WEBSITE_TOKEN` matches coordinator `WEBSITE_TOKEN`.
- at least one runner is `active` with positive submission/session capacity.
