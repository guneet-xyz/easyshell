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
