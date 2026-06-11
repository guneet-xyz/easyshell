import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR, getFs } from "@easyshell/utils/build"

const SLUG = "nuke-all-matches"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}) {
  const originalFs = await getFs(`${PROBLEMS_DIR}/${SLUG}/testcases/${id}`)
  const newFs: FsType = {}
  for (const [path, content] of Object.entries(originalFs)) {
    if (!path.endsWith(".log")) {
      newFs[path] = content
    }
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 9,
  slug: SLUG,
  title: "Nuke All Matches",
  description: `Some files are just junk, and they’re everywhere! Find them all and wipe them out. 💥`,
  difficulty: "easy",
  tags: ["rm", "find"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [
    { testcase: [1, 2], pass: true, input: "rm **/*.log" },
    { testcase: 3, pass: false, input: "rm **/*.log" },
    { testcase: "all", pass: true, input: "rm $(find -name '*.log')" },
  ],
}

export default config
