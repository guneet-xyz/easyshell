import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

import { execa } from "execa"

const SLUG = "filter-logs"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const { stdout: output } = await execa(
    "bash",
    [
      "-c",
      `jq -c 'select(.service == "authentication" and (.level == "warning" or .level == "error"))' services.log`,
    ],
    { cwd: testcase_dir },
  )
  return {
    id: id,
    public: isPublic,
    expected_stdout: output,
  }
}

const config: ProblemConfig = {
  id: 18,
  slug: SLUG,
  title: "Filter JSON Logs",
  description: `Extract authentication failures from JSON logs.`,
  difficulty: "easy",
  tags: ["jq"],
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
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `jq -c 'select(.service == "authentication" and (.level == "warning" or .level == "error"))' services.log`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat services.log | jq -c 'select(.service == "authentication" and (.level == "warning" or .level == "error"))'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat services.log | jq 'select(.service == "authentication")' | jq 'select(.level == "warning" or .level == "error")' | jq -c .`,
    },
  ],
}

export default config
