/**
 * Container output captured from a single execution.
 */
export interface ContainerOutput {
  stdout: string
  stderr: string
  exit_code: number
  fs: Record<string, string>
}

/**
 * Testcase expectations against which {@link ContainerOutput} is graded.
 * All fields are optional; `undefined` means "do not check this".
 */
export interface TestcaseExpectations {
  expected_stdout?: string
  expected_stderr?: string
  expected_exit_code?: number
  expected_fs?: Record<string, string | null>
}

/**
 * Checks whether container output passes the testcase expectations.
 *
 * Logic ported verbatim from `apps/submission-manager/utils.ts:48-82`.
 * Must produce byte-identical results for all inputs.
 */
export function computePassed(
  output: ContainerOutput,
  testcase: TestcaseExpectations,
): boolean {
  const fs = output.fs

  let passed = true
  if (passed && testcase.expected_stdout !== undefined)
    passed =
      output.stdout === testcase.expected_stdout ||
      output.stdout + "\n" === testcase.expected_stdout ||
      output.stdout === testcase.expected_stdout + "\n"

  if (passed && testcase.expected_stderr !== undefined)
    passed = passed && output.stderr === testcase.expected_stderr

  if (passed && testcase.expected_exit_code !== undefined)
    passed = output.exit_code === testcase.expected_exit_code

  if (passed && testcase.expected_fs !== undefined) {
    if (fs === undefined) {
      passed = false
    } else {
      if (Object.keys(fs).length !== Object.keys(testcase.expected_fs).length) {
        passed = false
      } else {
        for (const [path, expected] of Object.entries(testcase.expected_fs)) {
          const actual = fs[path]
          if (actual !== expected) {
            passed = false
            break
          }
        }
      }
    }
  }

  return passed
}
