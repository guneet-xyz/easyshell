import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR, getFs } from "@easyshell/utils/build"

const SLUG = "bulk-move"

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
    if (file.endsWith(".log")) {
      const basename = file.split("/").pop()!
      newFs[`logs/${basename}`] = originalFs[file]!
    } else {
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
  id: 6,
  slug: SLUG,
  title: "Bulk Move",
  description: `A scattered mess of log files? Gather them all into one place while leaving everything else untouched! 📂`,
  difficulty: "easy",
  tags: ["mv", "find"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [],
}

export default config
