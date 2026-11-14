import { execa } from "execa"

import type { ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "two-buckets"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const dir = testcaseDir(SLUG, id)
  const originalFs = await getFs(dir)
  const { stdout, stderr } = await execa("sh", ["deploy.sh"], {
    cwd: dir,
    reject: false,
    stripFinalNewline: false,
  })

  return {
    id: id,
    public: isPublic,
    expected_stdout: "",
    expected_fs: {
      ...originalFs,
      "deploy.out": stdout,
      "deploy.err": stderr,
    },
  }
}

const config: ProblemConfig = {
  id: 29,
  slug: SLUG,
  title: "Two Buckets",
  description: `Good news in one bucket, bad news in the other. Your boss only reads the first one. 🪣🪣`,
  difficulty: "medium",
  tags: ["redirection", "stderr"],
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
      input: `./deploy.sh > deploy.out 2> deploy.err`,
    },
    {
      testcase: "all",
      pass: true,
      input: `./deploy.sh 2>deploy.err >deploy.out`,
    },
    {
      testcase: "all",
      pass: true,
      input: `sh deploy.sh 1>deploy.out 2>deploy.err`,
    },
    {
      testcase: "all",
      pass: false,
      input: `./deploy.sh > deploy.out 2>&1`,
    },
    {
      testcase: 3,
      pass: false,
      input: `./deploy.sh >> deploy.out 2>> deploy.err`,
    },
    {
      testcase: "all",
      pass: false,
      input: `./deploy.sh 2>&1 > deploy.out`,
    },
  ],
}

export default config
