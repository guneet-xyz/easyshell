import { readdir, stat } from "fs/promises"
import { join } from "path"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "disk-hog"
const BLOCK = 4096

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const homeDirs = join(testcaseDir(SLUG, id), "home-dirs")
  // For every teammate, the total size of their files (what the problem asks
  // for) and the most `du` could report for them (files rounded up to whole
  // blocks, plus a block per directory). The hog must win by both measures.
  const usage: Array<{ name: string; bytes: number; maxDu: number }> = []
  for (const name of await readdir(homeDirs)) {
    let bytes = 0
    let maxDu = BLOCK
    for (const path of await readdir(join(homeDirs, name), {
      recursive: true,
    })) {
      const info = await stat(join(homeDirs, name, path))
      if (info.isFile()) {
        bytes += info.size
        maxDu += Math.ceil(info.size / BLOCK) * BLOCK
      } else if (info.isDirectory()) {
        maxDu += BLOCK
      }
    }
    usage.push({ name, bytes, maxDu })
  }
  usage.sort((a, b) => b.bytes - a.bytes)
  const [hog, ...others] = usage
  if (hog === undefined || others.some((o) => o.maxDu >= hog.bytes))
    throw new Error(`${SLUG} testcase ${id} has no clear disk hog`)

  return {
    id: id,
    public: isPublic,
    expected_stdout: hog.name,
  }
}

const config: ProblemConfig = {
  id: 65,
  slug: SLUG,
  title: "Disk Hog",
  description: `The shared server is full again. Somebody is hoarding. Name and shame. 🐷`,
  difficulty: "medium",
  tags: ["du", "sort"],
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
      input: `du -s home-dirs/*/ | sort -n | tail -n 1 | cut -f 2 | xargs basename`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find home-dirs -type f -exec stat -c '%s %n' {} + | awk '{ split($2, path, "/"); total[path[2]] += $1 } END { for (name in total) print total[name], name }' | sort -n | tail -n 1 | cut -d ' ' -f 2`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cd home-dirs
for d in *; do echo "$(du -s -b "$d" | cut -f 1) $d"; done | sort -n | tail -n 1 | cut -d ' ' -f 2`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `find home-dirs -type f -exec stat -c '%s %n' {} + | sort -n | tail -n 1 | cut -d / -f 2`,
    },
    {
      testcase: "all",
      pass: false,
      input: `du -s home-dirs/*/ | sort -n | tail -n 1 | cut -f 2`,
    },
    {
      testcase: "all",
      pass: false,
      input: `du -s home-dirs/*/ | sort -n | head -n 1 | cut -f 2 | xargs basename`,
    },
  ],
}

export default config
