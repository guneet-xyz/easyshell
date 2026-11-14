import type { FsType, ProblemConfig } from "@easyshell/problems/schema"
import { getFs, testcaseDir } from "@easyshell/utils/build"

const SLUG = "flatten-the-folders"

async function testcaseConfig({
  id,
  isPublic,
}: {
  id: number
  isPublic: boolean
}): Promise<ProblemConfig["testcases"][number]> {
  const originalFs = await getFs(testcaseDir(SLUG, id))
  const newFs: FsType = {}
  for (const [path, content] of Object.entries(originalFs)) {
    if (path.startsWith("inbox/")) {
      const relative = path.slice("inbox/".length)
      newFs[`inbox/${relative.replaceAll("/", "-")}`] = content
    } else {
      newFs[path] = content
    }
  }

  return {
    id: id,
    public: isPublic,
    expected_fs: newFs,
  }
}

const config: ProblemConfig = {
  id: 50,
  slug: SLUG,
  title: "Flatten the Folders",
  description: `Seventeen nested folders for one PDF? Not on your watch. 🥞`,
  difficulty: "hard",
  tags: ["find", "mv", "tr"],
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
      input: `cd inbox && find . -mindepth 2 -type f | while IFS= read -r f; do mv "$f" "$(printf '%s' "\${f#./}" | tr / -)"; done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find inbox -mindepth 2 -type f | while IFS= read -r f; do r=\${f#inbox/}; mv "$f" "inbox/$(echo "$r" | sed 's|/|-|g')"; done`,
    },
    {
      testcase: "all",
      pass: true,
      input: `find inbox -mindepth 2 -type f -exec sh -c 'r=\${1#inbox/}; mv "$1" "inbox/$(printf %s "$r" | tr / -)"' sh {} \\;`,
    },
    {
      testcase: "all",
      pass: false,
      input: `find inbox -mindepth 2 -type f -exec mv {} inbox/ \\;`,
    },
    {
      testcase: [1, 2, 4],
      pass: true,
      input: `find inbox -mindepth 2 -type f -name '*.*' | while IFS= read -r f; do mv "$f" "inbox/$(echo "\${f#inbox/}" | tr / -)"; done`,
    },
    {
      testcase: 3,
      pass: false,
      input: `find inbox -mindepth 2 -type f -name '*.*' | while IFS= read -r f; do mv "$f" "inbox/$(echo "\${f#inbox/}" | tr / -)"; done`,
    },
    {
      testcase: 3,
      pass: false,
      input: `find inbox -mindepth 2 -type f ! -name '.*' | while IFS= read -r f; do mv "$f" "inbox/$(echo "\${f#inbox/}" | tr / -)"; done`,
    },
    {
      testcase: [1, 2, 3],
      pass: true,
      input: `for f in $(find inbox -mindepth 2 -type f); do mv "$f" "inbox/$(echo "\${f#inbox/}" | tr / -)"; done`,
    },
    {
      testcase: 4,
      pass: false,
      input: `for f in $(find inbox -mindepth 2 -type f); do mv "$f" "inbox/$(echo "\${f#inbox/}" | tr / -)"; done`,
    },
    {
      testcase: 1,
      pass: true,
      input: `find inbox -mindepth 2 -type f | while IFS= read -r f; do mv "$f" "inbox/$(echo "\${f#inbox/}" | sed 's|/|-|')"; done`,
    },
    {
      testcase: [2, 3, 4],
      pass: false,
      input: `find inbox -mindepth 2 -type f | while IFS= read -r f; do mv "$f" "inbox/$(echo "\${f#inbox/}" | sed 's|/|-|')"; done`,
    },
  ],
}

export default config
