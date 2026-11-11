# Releases

easyshell is released with [release-please](https://github.com/googleapis/release-please). A release publishes the application images and the problem images that changed. Nothing is published from ordinary pushes to `main`, and no workflow can publish manually.

## How a release happens

1. Pull requests are merged into `main` with [Conventional Commits](https://www.conventionalcommits.org/) titles (squash merges use the PR title). `fix:` is a patch release, `feat:` a minor release, and `feat!:` or a `BREAKING CHANGE:` footer a major release. Before 1.0 (`bump-minor-pre-major`), a breaking change bumps the minor version instead, so 0.x never becomes 1.0.0 by itself; `v1.0.0` will be released deliberately by setting `release-as` in the release-please configuration. `docs:`, `ci:`, `test:` and `chore:` don't cause a release on their own.
2. On every push to `main`, the **Release** workflow (`.github/workflows/release.yml`) updates a single release PR. It bumps the version in `package.json` and `.release-please-manifest.json` and adds the changes to `CHANGELOG.md`. Those files are generated: don't edit them by hand.
3. Pull requests opened with `GITHUB_TOKEN` don't trigger workflows, so the release workflow dispatches **CI** (`.github/workflows/ci.yml`) on the release-PR branch whenever it creates or updates the release PR. Its checks show on the PR.
4. **Merging the release PR approves the release.** release-please creates the `vX.Y.Z` tag and the GitHub Release, and the same workflow run publishes it:
   1. It checks that the tag is a stable `vX.Y.Z` on `main`, points at the release commit and matches `package.json`.
   2. It runs the full CI suite on the exact release commit. Publishing depends on it.
   3. It builds and publishes the application images and the changed problem images, described below.

There is one version for the whole repository; the coordinator, runner, website and migrator images are always released together. The first release is `v0.1.0`. The release-please configuration sets `bootstrap-sha` to `230777b`, the last commit on `main` before the work that made it deployable on its own (PRs #340 to #346), so the first changelog lists that work rather than the project's whole history.

## CI

`ci.yml` runs on pull requests, pushes to `main`, release-PR branches (dispatched) and release commits (called by the release workflow). The **CI result** job summarizes all of its jobs and is the check to require in branch protection.

- Formatting (Prettier and gofmt), type checks and lint, unit tests (`pnpm test`), the entrypoint's golangci-lint and actionlint.
- Each application image is built and smoke-tested on `linux/amd64` and `linux/arm64` with `scripts/smoke-image.sh`, the same test a release runs on the pushed images. Nothing is pushed.
- Problem tests for the changed problems (see [Which problem images are rebuilt](#which-problem-images-are-rebuilt)). Pull requests test the problems they change; `main`, release PRs and release commits test the problems changed since the previous release, which are the ones the next release publishes. Each selected problem's images are built and its tests run against them: every test submission in its `config.ts`, and an empty submission that must fail, run in a container with the runner's limits and graded with the coordinator's rule.

## Application images

| Image                                 | Dockerfile                    |
| ------------------------------------- | ----------------------------- |
| `cr.guneet.dev/easyshell/coordinator` | `apps/coordinator/Dockerfile` |
| `cr.guneet.dev/easyshell/runner`      | `apps/runner/Dockerfile`      |
| `cr.guneet.dev/easyshell/website`     | `apps/website/Dockerfile`     |
| `cr.guneet.dev/easyshell/migrator`    | `apps/migrator/Dockerfile`    |

Each image is built natively on `ubuntu-24.04` (`linux/amd64`) and `ubuntu-24.04-arm` (`linux/arm64`) and pushed **by digest only**, with SBOM and provenance attestations. The workflow checks the attestations, pulls that exact digest and smoke-tests it on the same runner (`scripts/smoke-image.sh`: the coordinator and website start against a throwaway PostgreSQL and answer HTTP, the runner boots and has the Docker CLI, the migrator applies the migrations twice). Only after all eight builds pass does it combine the two digests of each image into a multi-architecture index and tag it:

| Tag      | Meaning                                                  |
| -------- | -------------------------------------------------------- |
| `vX.Y.Z` | The release.                                             |
| `vX.Y`   | The newest release of that minor line.                   |
| `vX`     | The newest release of that major line, from `v1.0.0` on. |
| `latest` | The newest release.                                      |

There are no other tags (no `edge`, `sha-…` or unprefixed versions). `vX.Y`, `vX` and `latest` only move when the release is the repository's latest GitHub Release, so re-running an older release never moves them back. The run summary lists each image's index digest.

Deployments pin `vX.Y.Z@sha256:…` (or a digest), never `latest` or an alias. Publishing a release doesn't change a running deployment; upgrading one is a separate change in its deployment repository.

The website image compiles in `NEXT_PUBLIC_POSTHOG_KEY` and `POSTHOG_HOST` from the GitHub variables of the same names (repository or `release` environment variables). Both are optional and public; without them analytics are off.

## Problem images

Each problem testcase has its own image, `cr.guneet.dev/easyshell-problems/<problem>-<testcase>`, named by `problemImageName` in `packages/problems/image.ts`. The runner pulls them by their `latest` tag when it starts a session or grades a submission. As an owner-accepted exception to the versioning rules, problem images:

- have **only a `latest` tag**, overwritten whenever the image changes, and no version tags;
- are rebuilt **only when their inputs changed** since the previous release, so releases keep scaling as problems are added.

They are otherwise published like the application images, in the same release run (`.github/workflows/publish-problem-images.yml`): built natively for `linux/amd64` and `linux/arm64`, pushed by digest with SBOM and provenance attestations, pulled back, and tested with that problem's tests before `latest` moves to the new multi-architecture index. The changed problems are split into at most 12 batches, built for both architectures with at most 12 jobs at a time.

Moving `latest` changes what new sessions and submissions use as soon as the release finishes, without a deployment. Only the repository's latest release moves problem images, so re-running an older release can't overwrite newer ones.

### Which problem images are rebuilt

`pnpm --filter @easyshell/problems run changed` (`packages/problems/scripts/changed.ts`) compares the release commit with the previous `vX.Y.Z` tag:

- A change under `packages/problems/data/problems/<problem>/` rebuilds that problem's images. New problems are built for the first time.
- A change to a shared input rebuilds every problem's images: `apps/entrypoint/` (compiled into every image), `packages/utils/`, anything in `packages/problems/` outside `data/` and its `README.md` (the build script with the base image, the schema, the tests) and `.github/workflows/publish-problem-images.yml`.
- Nothing else (the apps, the wiki and series, docs) rebuilds problem images. A release without such changes builds none.
- Without a previous release, as for `v0.1.0`, every problem image is built.

Images of deleted problems or testcases stay in the registry; delete them there if needed.

## One-time setup

These are repository settings for an owner; the workflows don't change them.

1. In Dockyard, create an automation key with **pull + push** on the `easyshell` and `easyshell-problems` projects.
2. In **Settings → Environments**, create the `release` environment with the secrets `DOCKER_USERNAME` (the key's `_key_…` username) and `DOCKER_PASSWORD` (its secret). Only the publishing jobs use this environment; CI and pull requests never see the credentials, and they are only used to log in, never passed to builds. If you restrict the environment's deployment branches, allow `main`.
3. In **Settings → Actions → General → Workflow permissions**, allow GitHub Actions to create and approve pull requests, so that release-please can open the release PR.
4. Require the **CI result** check in branch protection.

Registry access is over public HTTPS from GitHub-hosted runners; no VPN or tunnel is involved.

## When publishing fails

The tag and GitHub Release already exist when a publishing job fails. Fix the cause (credentials, registry availability, a failing smoke test or problem test) and use **Re-run failed jobs** on that release run; don't cut another release just to retry. Nothing is tagged until every image of a kind passed, so a failed run leaves the previous tags in place.

Re-run a failed problem image publication before the next release is merged: the next release only rebuilds problems changed since this one, and once it is the latest release, re-running this one no longer moves problem images. If a run can no longer be re-run, republish with a reviewed one-off workflow change rather than a manual push. If the failure is in the workflow definition itself, a re-run repeats it: fix the workflow in a PR instead. A change to `publish-problem-images.yml` makes the next release rebuild every problem image, as happened after v0.1.0.
