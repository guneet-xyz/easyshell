import { execa } from "execa"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "shhh-errors"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const { stdout } = await execa("sh", ["fortune-teller.sh"], {
    cwd: testcaseDir(SLUG, id),
    stripFinalNewline: false,
  })

  return {
    id: id,
    public: isPublic,
    expected_stdout: stdout,
    expected_stderr: "",
  }
}

const config: ProblemConfig = {
  id: 28,
  slug: SLUG,
  title: "Shhh, Errors",
  description: `A fortune teller who won't stop complaining. Keep the fortunes, silence the drama. 🤫`,
  difficulty: "easy",
  tags: ["redirection", "stderr"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
  ],
  tests: [
    { testcase: "all", pass: true, input: `./fortune-teller.sh 2>/dev/null` },
    { testcase: "all", pass: true, input: `sh fortune-teller.sh 2> /dev/null` },
    {
      testcase: "all",
      pass: true,
      input: `exec 2>/dev/null\n./fortune-teller.sh`,
    },
    { testcase: "all", pass: false, input: `./fortune-teller.sh` },
    { testcase: "all", pass: false, input: `./fortune-teller.sh >/dev/null` },
    {
      testcase: [3, 4],
      pass: false,
      input: `./fortune-teller.sh 2>&1 | grep -v -e WARNING -e ERROR`,
    },
  ],
}

export default config
