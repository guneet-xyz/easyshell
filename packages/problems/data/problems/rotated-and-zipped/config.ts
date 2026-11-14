import { readdir, readFile } from "fs/promises"
import { gunzipSync } from "zlib"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { testcaseDir } from "@easyshell/utils/build"

const SLUG = "rotated-and-zipped"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const dir = testcaseDir(SLUG, id)
  let notFound = 0
  for (const file of await readdir(dir)) {
    if (!file.startsWith("access.log")) continue
    const content = await readFile(`${dir}/${file}`)
    const log = (
      file.endsWith(".gz") ? gunzipSync(content) : content
    ).toString()
    for (const line of log.split("\n").filter(Boolean))
      if (line.split(" ")[8] === "404") notFound++
  }

  return {
    id: id,
    public: isPublic,
    expected_stdout: notFound.toString(),
  }
}

const config: ProblemConfig = {
  id: 57,
  slug: SLUG,
  title: "Rotated and Zipped",
  description: `Logrotate ate your evidence and gzipped it. Count the 404s anyway. 🗜️`,
  difficulty: "medium",
  tags: ["zcat", "gzip", "awk"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
    await testcaseConfig({ id: 4, isPublic: false }),
    await testcaseConfig({ id: 5, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `{ cat access.log access.log.1 2>/dev/null; zcat access.log.*.gz; } | awk '$9 == 404' | wc -l`,
    },
    {
      testcase: "all",
      pass: true,
      input: `for f in access.log*; do case "$f" in *.gz) zcat "$f" ;; *) cat "$f" ;; esac; done | awk '$9 == 404 {n++} END {print n + 0}'`,
    },
    {
      testcase: "all",
      pass: true,
      input: `cat access.log access.log.1 > all.log 2>/dev/null; for f in access.log.*.gz; do gunzip -c "$f" >> all.log; done; cut -d'"' -f3 all.log | grep -c '^ 404 '`,
    },
    {
      testcase: "all",
      pass: false,
      input: `grep -c 404 access.log*`,
    },
    {
      // Forgets the compressed logs.
      testcase: "all",
      pass: false,
      input: `cat access.log access.log.1 | awk '$9 == 404' | wc -l`,
    },
    {
      // 404 also shows up as a size or a response time.
      testcase: [4],
      pass: false,
      input: `{ cat access.log access.log.1 2>/dev/null; zcat access.log.*.gz; } | grep -c ' 404 '`,
    },
  ],
}

export default config
