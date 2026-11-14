import { readdir, stat } from "fs/promises"
import { join } from "path"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "the-heavyweight"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const dir = testcaseDir(SLUG, id)
  let largest: { path: string; size: number } | undefined
  let tie = false
  for (const path of await readdir(join(dir, "storage"), {
    recursive: true,
  })) {
    const info = await stat(join(dir, "storage", path))
    if (!info.isFile()) continue
    if (largest === undefined || info.size > largest.size) {
      largest = { path, size: info.size }
      tie = false
    } else if (info.size === largest.size) {
      tie = true
    }
  }
  if (largest === undefined || tie)
    throw new Error(`${SLUG} testcase ${id} needs exactly one largest file`)

  return {
    id: id,
    public: isPublic,
    expected_stdout: `storage/${largest.path}`,
  }
}

const config: ProblemConfig = {
  id: 62,
  slug: SLUG,
  title: "The Heavyweight",
  description: `Disk usage: 99%. Somewhere in there is a file that's been eating well. 🍔`,
  difficulty: "easy",
  tags: ["find", "stat", "sort"],
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
      input: `find storage -type f -exec stat -c '%s %n' {} + | sort -n | tail -n 1 | cut -d ' ' -f 2-`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find storage -type f | while IFS= read -r f; do echo "$(wc -c < "$f") $f"; done | sort -n | tail -n 1 | cut -d ' ' -f 2-`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find storage -type f -exec ls -S {} + | head -n 1`,
    },
    {
      testcase: "all",
      pass: false,
      input: `ls -S storage | head -n 1`,
    },
    {
      testcase: "all",
      pass: false,
      input: `du -a storage | sort -n | tail -n 1 | cut -f 2`,
    },
    {
      testcase: [4],
      pass: false,
      input: `find storage -type f | xargs ls -S | head -n 1`,
    },
  ],
}

export default config
