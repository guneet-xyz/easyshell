import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "backup-before-you-wreck"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const originalFs = await getFs(testcaseDir(SLUG, id))
  const newFs: FsType = { ...originalFs }
  for (const [path, content] of Object.entries(originalFs)) {
    if (path.startsWith("project/")) {
      newFs[path.replace(/^project\//, "project.bak/")] = content
    }
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 48,
  slug: SLUG,
  title: "Backup Before You Wreck",
  description: `Your boss learned about backups. From you. The hard way. 💾`,
  difficulty: "easy",
  tags: ["cp"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
  ],
  tests: [
    { testcase: "all", pass: true, input: `cp -r project project.bak` },
    { testcase: "all", pass: true, input: `cp -a project project.bak` },
    {
      testcase: "all",
      pass: true,
      input: `mkdir project.bak && tar -C project -cf - . | tar -C project.bak -xf -`,
    },
    {
      testcase: [1, 2, 4],
      pass: true,
      input: `mkdir project.bak && cp -r project/* project.bak/`,
    },
    {
      testcase: 3,
      pass: false,
      input: `mkdir project.bak && cp -r project/* project.bak/`,
    },
    {
      testcase: 4,
      pass: false,
      input: `for f in $(find project -type f); do mkdir -p "$(dirname "project.bak/\${f#project/}")" && cp "$f" "project.bak/\${f#project/}"; done`,
    },
    { testcase: "all", pass: false, input: `mv project project.bak` },
  ],
}

export default config
