import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR, getFs } from "@easyshell/utils/build"

const SLUG = "rm-that-file"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}) {
  const originalFs = await getFs(`${PROBLEMS_DIR}/${SLUG}/testcases/${id}`)
  const newFs: FsType = {}
  for (const file in originalFs) {
    if (file !== "logs.txt") {
      newFs[file] = originalFs[file]!
    }
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 7,
  slug: SLUG,
  title: "Remove That File",
  description: `A single file is standing in the way—time to delete it and clear the clutter! 🗑️`,
  difficulty: "easy",
  tags: ["rm"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
  ],
  tests: [{ testcase: "all", pass: true, input: "rm logs.txt" }],
}

export default config
