import { describe, expect, it } from "vitest"

import {
  computePassed,
  type ContainerOutput,
  type TestcaseExpectations,
} from "../../src/grading/passed-check"

function run(output: ContainerOutput, exp: TestcaseExpectations) {
  return computePassed(output, exp)
}

const base: ContainerOutput = {
  stdout: "hello\n",
  stderr: "",
  exit_code: 0,
  fs: {},
}

describe("computePassed — parity with submission-manager/utils.ts:48-82", () => {
  it("1. no expectations → always passes", () => {
    expect(run(base, {})).toBe(true)
  })
  it("2. stdout exact match", () => {
    expect(run(base, { expected_stdout: "hello\n" })).toBe(true)
  })
  it("3. stdout match with trailing newline tolerance (output missing trailing newline)", () => {
    expect(
      run({ ...base, stdout: "hello" }, { expected_stdout: "hello\n" }),
    ).toBe(true)
  })
  it("4. stdout match with trailing newline tolerance (expected missing trailing newline)", () => {
    expect(
      run({ ...base, stdout: "hello\n" }, { expected_stdout: "hello" }),
    ).toBe(true)
  })
  it("5. stdout mismatch", () => {
    expect(run(base, { expected_stdout: "world\n" })).toBe(false)
  })
  it("6. stderr exact match", () => {
    expect(run(base, { expected_stderr: "" })).toBe(true)
  })
  it("7. stderr mismatch", () => {
    expect(run(base, { expected_stderr: "error\n" })).toBe(false)
  })
  it("8. exit_code match", () => {
    expect(run(base, { expected_exit_code: 0 })).toBe(true)
  })
  it("9. exit_code mismatch", () => {
    expect(run(base, { expected_exit_code: 1 })).toBe(false)
  })
  it("10. fs match", () => {
    expect(
      run(
        { ...base, fs: { "/home/out.txt": "data" } },
        { expected_fs: { "/home/out.txt": "data" } },
      ),
    ).toBe(true)
  })
  it("11. fs key mismatch (different file count)", () => {
    expect(
      run(
        { ...base, fs: { "/home/a.txt": "a", "/home/b.txt": "b" } },
        { expected_fs: { "/home/a.txt": "a" } },
      ),
    ).toBe(false)
  })
  it("12. fs value mismatch", () => {
    expect(
      run(
        { ...base, fs: { "/home/out.txt": "wrong" } },
        { expected_fs: { "/home/out.txt": "data" } },
      ),
    ).toBe(false)
  })
})
