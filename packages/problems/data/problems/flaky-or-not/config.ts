import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

import { execa } from "execa"

const SLUG = "flaky-or-not"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const exitCode = await execa("./flaky-command.sh", {
    cwd: testcase_dir,
    reject: false,
  })

  return {
    id: id,
    public: isPublic,
    expected_stdout: exitCode.exitCode === 0 ? "Passed" : "Failed",
  }
}

const config: ProblemConfig = {
  id: 25,
  slug: SLUG,
  title: "Flaky or Not",
  description: `Run a mysterious script and report if it flops or flies!`,
  difficulty: "easy",
  tags: ["if"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
    }),
    await testcaseConfig({
      id: 4,
      isPublic: false,
    }),
    await testcaseConfig({
      id: 5,
      isPublic: false,
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `./flaky-command.sh > /dev/null 2>&1 ; if [ $? -eq 0 ]; then echo "Passed"; else echo "Failed"; fi`,
    },
  ],
}

export default config
