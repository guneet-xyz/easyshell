import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, PROBLEMS_DIR } from "@easyshell/utils/build"

const SLUG = "unwrap-the-present"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  // The files that were already there stay, the wrapping paper goes and the
  // contents of the present (fixtures/<id>, see generate.sh) appear.
  const before = await getFs(`${PROBLEMS_DIR}/${SLUG}/testcases/${id}`)
  const present = await getFs(`${PROBLEMS_DIR}/${SLUG}/fixtures/${id}`)
  const expected: FsType = {}
  for (const [path, content] of Object.entries(before)) {
    if (path !== "present.tar.gz") expected[path] = content
  }
  for (const [path, content] of Object.entries(present)) {
    expected[path] = content
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: expected,
  }
}

const config: ProblemConfig = {
  id: 59,
  slug: SLUG,
  title: "Unwrap the Present",
  description: `Grandma learned what a tarball is. Your birthday will never be the same. 🎁`,
  difficulty: "easy",
  tags: ["tar", "gzip"],
  testcases: [
    await testcaseConfig({ id: 1, isPublic: true }),
    await testcaseConfig({ id: 2, isPublic: true }),
    await testcaseConfig({ id: 3, isPublic: false }),
  ],
  tests: [
    {
      testcase: "all",
      pass: true,
      input: `tar -xzf present.tar.gz && rm present.tar.gz`,
    },
    {
      testcase: "all",
      pass: true,
      input: `gunzip -c present.tar.gz | tar -xf - && rm present.tar.gz`,
    },
    {
      testcase: "all",
      pass: true,
      input: `gunzip present.tar.gz\ntar -xvf present.tar\nrm present.tar`,
    },
    {
      testcase: "all",
      pass: false,
      input: `tar -xzf present.tar.gz`,
    },
    {
      testcase: "all",
      pass: false,
      input: `gunzip present.tar.gz && tar -xf present.tar`,
    },
    {
      testcase: [3],
      pass: false,
      input: `mkdir unwrapped && tar -xzf present.tar.gz -C unwrapped && mv unwrapped/* . && rmdir unwrapped && rm present.tar.gz`,
    },
  ],
}

export default config
