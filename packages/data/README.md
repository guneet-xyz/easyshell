# problems

This package contains problems featured on the website, as well scripts for building, testing and deployment.

> Note: This package is not meant to be used as a library import. You may use it for types as a dev dependency, but it is better to avoid that as well.

## Scripts

Run the scripts using `npm run <script-name>`.

- `build` - Build the test case images for the problems
- `test` - Test the problems. Pass the `SKIP_SUBMISSION_TESTS` environment variable to skip the submission tests (useful for checking only the config).
- `new` - Create template for a new problem.
- `cache:website` - Create the problems cache for the website.
- `cache:submission-manager` - Create the problems cache for the queue processor.
