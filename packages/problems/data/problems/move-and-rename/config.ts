import type { ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR } from "@easyshell/utils/build"

import { readFile } from "fs/promises"

const SLUG = "move-and-rename"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}) {
  return {
    id: id,
    public: isPublic,
    expected_fs: {
      "index.html": (
        await readFile(`${PROBLEMS_DIR}/${SLUG}/testcases/${id}/index.htlm`)
      ).toString(),
    },
  }
}

const config: ProblemConfig = {
  id: 5,
  slug: SLUG,
  title: "Move And Rename",
  description: `Sometimes, files end up in the wrong place with the wrong name.`,
  difficulty: "easy",
  tags: ["mv"],
  testcases: [await testcaseConfig({ id: 1, isPublic: true })],
  tests: [{ testcase: 1, pass: true, input: "mv index.htlm index.html" }],
}

export default config
