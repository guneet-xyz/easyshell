import type { ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "count-files"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const testcase_dir = testcaseDir(SLUG, id)
  const files = Object.keys(await getFs(testcase_dir)).length

  return {
    id: id,
    public: isPublic,
    expected_stdout: files.toString(),
  }
}

const config: ProblemConfig = {
  id: 19,
  slug: SLUG,
  title: "Count Files",
  description: `Count every file (including hidden ones) in the current directory and below.`,
  difficulty: "easy",
  tags: ["find", "wc"],
  testcases: [
    await testcaseConfig({
      id: 1,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 2,
      isPublic: true,
    }),
    await testcaseConfig({
      id: 3,
      isPublic: false,
    }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `find . -type f | wc -l`,
    },
  ],
}

export default config
