import { readFile } from "fs/promises"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "exit-stage-left"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const verdict = await readFile(
    `${testcaseDir(SLUG, id)}/verdict.txt`,
    "utf-8",
  )
  const ship = verdict === "ship it\n"

  return {
    id: id,
    public: isPublic,
    expected_stdout: ship ? "🚀 shipping\n" : "🛑 blocked\n",
    expected_exit_code: ship ? 0 : 1,
  }
}

const config: ProblemConfig = {
  id: 34,
  slug: SLUG,
  title: "Exit Stage Left",
  description: `The CI pipeline can't read. It only understands exit codes. 🚦`,
  difficulty: "easy",
  tags: ["exit", "if"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `if [ "$(cat verdict.txt)" = "ship it" ]; then echo '🚀 shipping'; exit 0; else echo '🛑 blocked'; exit 1; fi`,
    },
    {
      testcase: "all",
      pass: true,
      input: `grep -qx 'ship it' verdict.txt && { echo '🚀 shipping'; exit 0; }\necho '🛑 blocked'\nexit 1`,
    },
    {
      testcase: "all",
      pass: true,
      input: `case "$(cat verdict.txt)" in
  "ship it") echo '🚀 shipping' ;;
  *) echo '🛑 blocked'; exit 1 ;;
esac`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `grep -q 'ship it' verdict.txt && echo '🚀 shipping' || echo '🛑 blocked'`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `if [ "$(cat verdict.txt)" = "ship it" ]; then echo '🚀 shipping'; else echo '🛑 blocked'; fi`,
    },
    {
      testcase: 3,
      pass: false,
      input: `if grep -q 'ship it' verdict.txt; then echo '🚀 shipping'; else echo '🛑 blocked'; exit 1; fi`,
    },
  ],
}

export default config
