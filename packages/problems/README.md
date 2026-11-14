# problems

This package contains problems featured on the website, as well scripts for building, testing and deployment.

> Note: This package is not meant to be used as a library import. You may use it for types as a dev dependency, but it is better to avoid that as well.

## Scripts

Run the scripts using `pnpm run <script-name>`.

- `build` - Build the test case images for one or more problems (or `all`) locally. `--contexts-only` only writes the build contexts and `images.json` (used by releases, which build and publish them with buildx).
- `test` - Test one or more problems (or `all`; `base` runs only the series and wiki checks). Each test submission in a problem's config, plus an empty submission that must fail, runs against the locally built testcase images with the runner's limits. Pass the `SKIP_SUBMISSION_TESTS` environment variable to skip the submission tests (useful for checking only the config).
- `changed` - List the problems whose images changed since a base commit or the previous release, as CI and releases use it. See [Releases](../../docs/releases.md#which-problem-images-are-rebuilt).
- `new` - Create template for a new problem.
- `cache:website` - Create the problems cache for the website.

## Writing problems

Each problem lives in `data/problems/<slug>/`:

- `config.ts`: the ID, slug, title, a one-line `description`, difficulty, tags, the testcases and the `tests` (see `schema.ts`). Copy the shape of a similar problem, e.g. `filter-logs` for computed stdout, `bulk-move` for `expected_fs` and `post-with-token` for an HTTP daemon.
- `page.md`: a `# Problem Statement` (the story) and `# Instructions` (a precise, numbered spec). Every edge case a hidden testcase checks must be stated in the instructions.
- `hints/1.md` … `hints/N.md`: from a gentle nudge to nearly the answer.
- `testcases/<id>/`: the files copied into the user's home directory (`/home`, also the working directory) for that testcase. A testcase with an empty home needs no folder.
- Add the problem to a section in `data/series.ts`.

Rules:

- At least 3 testcases, the first 1–2 public. **Every testcase must fail an empty submission**; `test` checks this.
- `tests` should have at least 2 different passing solutions and at least 1 plausible wrong one (`pass: false`), each listing the testcases it applies to.
- Submissions run as `sh /input.sh` in `/home` with **BusyBox `sh`** on Alpine 3.21: BusyBox applets plus `zip`, `jq`, `curl` and GNU `grep`. There is no bash or python. Limits are 64 MiB of memory, 0.1 CPU, 30 seconds and no network (daemons listen on localhost). Check commands with `docker run --rm alpine:3.21 sh -c '...'`.
- `expected_stdout` matches exactly, except for one trailing newline. `expected_fs` compares the contents of all regular files under `/home`, and the number of files must match; it ignores permissions, symlinks and empty directories. Never put binary files in `expected_fs`.
- Scripts in testcases start with `#!/bin/sh` and are committed with mode `100755` (`git update-index --chmod=+x <file>`). Generated fixtures must be deterministic.
- Keep testcases small (well under 200 KB).
- Don't change the base image or the entrypoint in `scripts/build.ts` and `apps/entrypoint/` as part of a problem: that rebuilds every problem image on the next release (see [Releases](../../docs/releases.md#which-problem-images-are-rebuilt)).

Test locally (Docker required):

```sh
pnpm --filter @easyshell/problems run build <slug...>
pnpm --filter @easyshell/problems run test <slug...>
pnpm --filter @easyshell/problems run test base
```

`WORKING_DIR` sets the scratch directory and `PARALLEL_LIMIT` the number of parallel builds and tests (default 5). Remove the images afterwards with `docker image rm easyshell-problems/<slug>-<testcase>`.
