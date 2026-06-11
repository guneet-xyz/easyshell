import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

import { execa } from "execa"

const SLUG = "show-hidden-files"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const expected_output = (
    await execa("sh", ["-c", `find . -path '*/.*' | LC_ALL=C sort`], {
      cwd: testcase_dir,
    })
  ).stdout.trim()
  return { id: id, public: isPublic, expected_stdout: expected_output }
}

const config: ProblemConfig = {
  id: 23,
  slug: SLUG,
  title: "Show Hidden Files",
  description: `Reveal all the sneaky hidden files and folders in your current directory.`,
  difficulty: "easy",
  tags: ["find"],
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
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `find . -path '*/.*' | sort`,
    },
  ],
}

export default config
