import type { ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR } from "@easyshell/utils/build"

import { readFile } from "fs/promises"

const SLUG = "cat-out-loud"

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
    expected_stdout: (
      await readFile(`${PROBLEMS_DIR}/${SLUG}/testcases/${id}/notes.txt`)
    ).toString(),
  }
}

const config: ProblemConfig = {
  id: 2,
  slug: SLUG,
  title: "Read a File",
  description: `Bring the contents of any file right into your terminal view. No GUIs allowed! 🖥️`,
  difficulty: "easy",
  tags: ["cat"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [{ testcase: "all", pass: true, input: "cat notes.txt" }],
}

export default config
