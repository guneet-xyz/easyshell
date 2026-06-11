import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "mdx-no-more"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const newFs: FsType = {}
  const fs = await getFs(testcaseDir(SLUG, id))
  for (const file in fs) {
    if (!file.endsWith(".mdx")) {
      newFs[file] = fs[file]!
      continue
    } else {
      const newFile = file.replace(/\.mdx$/, ".md")
      newFs[newFile] = fs[file]!
    }
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 14,
  slug: SLUG,
  title: "Bye Bye MDX, Hello MD!",
  description: `Rename all .mdx files to .md because your plugin can't handle the fancy stuff.`,
  difficulty: "hard",
  tags: ["mv", "find", "xargs", "sed", "grep"],
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
      input: `find . -type f -name '*.mdx' | sed 's/\.mdx$/.md/' | xargs -I {} mv {}x {}`,
    },
  ],
}

export default config
