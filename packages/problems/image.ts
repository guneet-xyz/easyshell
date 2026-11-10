/** Registry project that holds every problem testcase image. */
export const PROBLEM_IMAGE_PROJECT = "easyshell-problems"

/**
 * Image name for a problem testcase, e.g. `easyshell-problems/list-files-1`.
 * Images are built and tagged locally under this name; when `DOCKER_REGISTRY`
 * is set, the push script and the runner prefix it with the registry.
 */
export function problemImageName(
  problemSlug: string,
  testcaseId: number | string,
): string {
  return `${PROBLEM_IMAGE_PROJECT}/${problemSlug}-${testcaseId}`
}
