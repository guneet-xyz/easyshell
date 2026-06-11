import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { PROBLEMS_DIR, getFs } from "@easyshell/utils/build"

const SLUG = "move-that-file"

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
    if (path !== "payload.json") {
      newFs[path] = content
    }
  }
  newFs["datadir/payload.json"] = originalFs["payload.json"]!

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 4,
  slug: "move-that-file",
  title: "Move That File",
  description: `Move a file from one location to another—because sometimes, things just need to be somewhere else. 🚀`,
  difficulty: "easy",
  tags: ["mv"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: false }),
  ],
  tests: [
    { testcase: 1, pass: true, input: "mv payload.json datadir" },
    { testcase: 2, pass: false, input: "mv payload.json datadir" },
    {
      testcase: "all",
      pass: true,
      input: "mkdir -p datadir && mv payload.json datadir",
    },
  ],
}

export default config
