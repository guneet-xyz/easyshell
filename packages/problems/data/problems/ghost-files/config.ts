import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, PROBLEMS_DIR } from "@easyshell/utils/build"

const SLUG = "ghost-files"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const originalFs = await getFs(`${PROBLEMS_DIR}/${SLUG}/testcases/${id}`)
  const newFs: FsType = {}
  for (const [path, content] of Object.entries(originalFs)) {
    if (content !== "") newFs[path] = content
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 63,
  slug: SLUG,
  title: "Ghost Files",
  description: `Your project is haunted by files with nothing inside. Who you gonna call? 👻`,
  difficulty: "easy",
  tags: ["find", "rm"],
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
      input: `find . -type f -empty -delete`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find . -type f -size 0 -exec rm {} +`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find . -type f | while IFS= read -r f; do [ -s "$f" ] || rm "$f"; done`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `rm $(find . -empty)`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `for f in *; do [ -s "$f" ] || rm "$f"; done`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `find . -type f -size -2c -delete`,
    },
    {
      testcase: [3, 4],
      pass: false,
      input: `find . -type f -empty | xargs rm`,
    },
  ],
}

export default config
