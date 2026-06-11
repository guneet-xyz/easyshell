import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR, getFs } from "@easyshell/utils/build"

const SLUG = "wipe-that-folder"

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
    if (!file.startsWith("logs/")) {
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
  id: 8,
  slug: SLUG,
  title: "Wipe That Folder",
  description: `A whole folder needs to be erased. Make sure it’s gone—completely! 🚮`,
  difficulty: "easy",
  tags: ["rm"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [{ testcase: "all", pass: true, input: "rm -r logs" }],
}

export default config
