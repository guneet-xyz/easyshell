import { existsSync } from "fs"

import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "dear-diary"
const ENTRY = "Dear Diary, today I learned redirection.\n"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  // Testcase 1 starts with an empty home, which git can't store as a folder.
  const dir = testcaseDir(SLUG, id)
  const originalFs: FsType = existsSync(dir) ? await getFs(dir) : {}

  return {
    id: id,
    public: isPublic,
    expected_stdout: "",
    expected_fs: { ...originalFs, "diary.txt": ENTRY },
  }
}

const config: ProblemConfig = {
  id: 26,
  slug: SLUG,
  title: "Dear Diary",
  description: `Your feelings deserve a file, not just a terminal. 📔`,
  difficulty: "easy",
  tags: ["echo", "redirection"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `echo "Dear Diary, today I learned redirection." > diary.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `printf 'Dear Diary, today I learned redirection.\\n' > diary.txt`,
    },
    {
      testcase: "all",
      pass: true,
      input: `rm -f diary.txt\necho 'Dear Diary, today I learned redirection.' >> diary.txt`,
    },
    {
      testcase: [2, 3],
      pass: false,
      input: `echo "Dear Diary, today I learned redirection." >> diary.txt`,
    },
    {
      testcase: "all",
      pass: false,
      input: `echo "Dear Diary, today I learned redirection." > diary.txt\ncat diary.txt`,
    },
  ],
}

export default config
